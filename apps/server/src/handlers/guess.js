import { EVENTS, REDIS_KEYS, GAME } from '@sketchbattle/shared';
import { redis } from '../index.js';
import prisma from '../lib/prisma.js';
import * as gameState from '../services/gameStateService.js';
import * as wordService from '../services/wordService.js';
import * as scoreService from '../services/scoreService.js';
import * as timerService from '../services/timerService.js';
import * as roundServiceMod from '../services/roundService.js';
import { handleDualGuess } from './dualBattle.js';
import { isRateLimited } from '../middleware/rateLimit.js';

export function registerGuessHandlers(io, socket) {

  socket.on(EVENTS.GUESS_SUBMIT, async (data) => {
    try {
      if (!socket.roomId) return;

      const state = await gameState.getRoomState(socket.roomId);
      if (!state || state.phase !== 'drawing') return;

      if (state.mode !== 'dual_battle' && state.currentDrawerUserId === socket.userId) return;

      const player = await gameState.getPlayer(socket.roomId, socket.userId);
      if (!player || player.role !== 'player') return;

      const limited = await isRateLimited(
        REDIS_KEYS.rateGuess(socket.userId),
        GAME.MAX_GUESSES_PER_SEC,
        1000
      );
      if (limited) {
        socket.emit(EVENTS.ERROR, { message: 'Too many guesses, slow down!' });
        return;
      }

      const { text } = data;
      if (!text || typeof text !== 'string' || text.trim().length === 0) return;
      const guessText = text.trim().substring(0, 100);

      if (state.mode === 'dual_battle') {
        await handleDualGuess(io, socket, state, guessText, player);
        return;
      }

      const roundId = state.currentRoundId;
      if (!roundId) return;

      const alreadyGuessed = await redis.sismember(REDIS_KEYS.guessed(roundId), socket.userId);
      if (alreadyGuessed) {
        io.to(socket.roomId).emit(EVENTS.CHAT_MESSAGE, {
          userId: socket.userId,
          username: socket.username,
          text: guessText,
          timestamp: Date.now(),
          isGuess: false,
        });
        return;
      }

      const word = await wordService.getRoundWord(roundId);
      if (!word) return;

      const isCorrect = guessText.toLowerCase() === word.toLowerCase();

      if (!isCorrect) {
        io.to(socket.roomId).emit(EVENTS.CHAT_MESSAGE, {
          userId: socket.userId,
          username: socket.username,
          text: guessText,
          timestamp: Date.now(),
          isGuess: true,
          isClose: isCloseGuess(guessText, word),
        });

        prisma.guess.create({
          data: {
            roundId,
            userId: socket.userId,
            team: player.team || 'none',
            guessText,
            isCorrect: false,
            scoreAwarded: 0,
          },
        }).catch(() => {});
        return;
      }

      const [, remainingMs] = await Promise.all([
        redis.sadd(REDIS_KEYS.guessed(roundId), socket.userId),
        timerService.getRemainingMs(roundId),
      ]);
      redis.expire(REDIS_KEYS.guessed(roundId), 10800);

      const totalMs = state.drawTimeSecs * 1000;

      const [correctCount, players] = await Promise.all([
        redis.scard(REDIS_KEYS.guessed(roundId)),
        gameState.getPlayers(socket.roomId),
      ]);

      const totalPlayers = players.filter(p => p.role === 'player').length;
      const difficulty = state.wordDifficulty || 'medium';

      const score = scoreService.calculateGuesserScore({
        remainingMs,
        totalMs,
        correctGuessCount: correctCount - 1,
        totalPlayers,
        difficulty,
      });

      await Promise.all([
        gameState.addScore(socket.roomId, socket.userId, score),
        gameState.updatePlayer(socket.roomId, socket.userId, {
          score: (player.score || 0) + score,
        }),
      ]);

      io.to(socket.roomId).emit(EVENTS.GUESS_RESULT, {
        userId: socket.userId,
        username: socket.username,
        isCorrect: true,
        score,
        totalCorrect: correctCount,
        team: player.team || 'none',
      });

      const updatedScores = await gameState.getScores(socket.roomId);
      const pMap = Object.fromEntries(players.map(p => [p.userId, p]));
      io.to(socket.roomId).emit(EVENTS.SCORE_UPDATE, {
        scores: updatedScores.map(s => ({
          ...s,
          username: pMap[s.userId]?.username || 'Unknown',
        })),
      });

      const elapsed = totalMs - remainingMs;
      prisma.guess.create({
        data: {
          roundId,
          userId: socket.userId,
          team: player.team || 'none',
          guessText,
          isCorrect: true,
          scoreAwarded: score,
          guessedAtElapsedMs: Math.floor(elapsed),
        },
      }).catch(e => {
        if (e.code !== 'P2002') console.error('[guess] DB write failed:', e.message);
      });

      prisma.roomPlayer.updateMany({
        where: { roomId: socket.roomId, userId: socket.userId },
        data: { totalScore: { increment: score } },
      }).catch(() => {});

      const guessers = players.filter(
        p => p.role === 'player' && p.userId !== state.currentDrawerUserId
      );
      if (correctCount >= guessers.length) {
        await roundServiceMod.endRound(io, socket.roomId, roundId);
      }
    } catch (err) {
      console.error('Guess error:', err);
    }
  });
}

function isCloseGuess(guess, word) {
  const g = guess.toLowerCase();
  const w = word.toLowerCase();
  if (g.length < 2 || w.length < 2) return false;
  let matches = 0;
  const maxLen = Math.max(g.length, w.length);
  for (let i = 0; i < Math.min(g.length, w.length); i++) {
    if (g[i] === w[i]) matches++;
  }
  return matches / maxLen >= 0.6 && g !== w;
}
