import crypto from 'crypto';
import prisma, { withRetry } from '../lib/prisma.js';
import { redis } from '../index.js';
import { REDIS_KEYS, GAME, EVENTS } from '@sketchbattle/shared';
import * as gameState from './gameStateService.js';
import * as wordService from './wordService.js';
import * as timerService from './timerService.js';
import * as strokeService from './strokeService.js';
import * as scoreService from './scoreService.js';
import { saveReplay } from './replayService.js';

export async function startGame(io, roomId, room) {
  const players = await gameState.getPlayers(roomId);
  const activePlayers = players
    .filter(p => p.role === 'player' && p.isConnected)
    .sort((a, b) => a.seatOrder - b.seatOrder);

  const pipeline = redis.pipeline();
  for (const p of activePlayers) {
    pipeline.zadd(REDIS_KEYS.scores(roomId), 0, p.userId);
  }
  pipeline.expire(REDIS_KEYS.scores(roomId), 86400);
  await pipeline.exec();

  await gameState.setRoomState(roomId, {
    status: 'in_progress',
    mode: room.mode,
    currentRound: 0,
    roundCount: room.roundCount,
    drawTimeSecs: room.drawTimeSecs,
    phase: 'idle',
    clearGeneration: 0,
    drawerSeatIndex: 0,
    wordPackId: room.wordPackId || '',
  });

  withRetry(() => prisma.room.update({
    where: { id: roomId },
    data: { status: 'in_progress', startedAt: new Date() },
  })).catch(e => console.error('[startGame] DB update failed:', e.message));

  io.to(roomId).emit(EVENTS.GAME_STARTED, {
    roundCount: room.roundCount,
    drawTimeSecs: room.drawTimeSecs,
    playerCount: activePlayers.length,
    mode: room.mode,
  });

  await startNextRound(io, roomId);
}

export async function startNextRound(io, roomId) {
  const [state, players] = await Promise.all([
    gameState.getRoomState(roomId),
    gameState.getPlayers(roomId),
  ]);
  if (!state) {
    console.error('[startNextRound] No room state for', roomId);
    return;
  }

  const nextRound = state.currentRound + 1;
  if (nextRound > state.roundCount) {
    await endGame(io, roomId);
    return;
  }

  const activePlayers = players
    .filter(p => p.role === 'player')
    .sort((a, b) => a.seatOrder - b.seatOrder);

  if (activePlayers.length < GAME.MIN_PLAYERS) {
    await endGame(io, roomId);
    return;
  }

  const drawerIndex = (nextRound - 1) % activePlayers.length;
  const drawer = activePlayers[drawerIndex];

  const wordChoicesPromise = wordService.pickWordChoices(state.wordPackId || null);

  await gameState.setRoomState(roomId, {
    currentRound: nextRound,
    currentDrawerUserId: drawer.userId,
    phase: 'selecting',
    drawerSeatIndex: drawerIndex,
    wordHint: '',
    currentRoundId: '',
  });

  io.to(roomId).emit(EVENTS.ROUND_SELECTING, {
    roundNumber: nextRound,
    totalRounds: state.roundCount,
    drawerUserId: drawer.userId,
    drawerUsername: drawer.username,
  });

  const wordChoices = await wordChoicesPromise;

  const [, session] = await Promise.all([
    redis.set(REDIS_KEYS.wordChoices(roomId), JSON.stringify(wordChoices), 'EX', 20),
    redis.hgetall(REDIS_KEYS.session(drawer.userId)),
  ]);

  if (session?.socketId) {
    io.to(session.socketId).emit(EVENTS.ROUND_WORD_CHOICES, {
      words: wordChoices.map(w => w.word),
      roundNumber: nextRound,
    });
  }

  setTimeout(async () => {
    const currentState = await gameState.getRoomState(roomId);
    if (currentState?.phase === 'selecting' && currentState.currentRound === nextRound) {
      await selectWord(io, roomId, 0);
    }
  }, GAME.WORD_SELECT_TIME_MS);

  redis.set(`game:selecttimer:${roomId}`, '1', 'PX', GAME.WORD_SELECT_TIME_MS);
}

export async function selectWord(io, roomId, wordIndex) {
  const state = await gameState.getRoomState(roomId);
  if (!state || state.phase !== 'selecting') {
    console.error('[selectWord] Invalid state:', roomId, state?.phase);
    return;
  }

  const choicesRaw = await redis.get(REDIS_KEYS.wordChoices(roomId));
  if (!choicesRaw) {
    console.error('[selectWord] No word choices found for', roomId);
    return;
  }

  const choices = JSON.parse(choicesRaw);
  const idx = Math.min(wordIndex, choices.length - 1);
  const chosen = choices[idx];

  const roundId = crypto.randomUUID();

  const hint = wordService.generateInitialHint(chosen.word);

  const [timerEndMs] = await Promise.all([
    timerService.startRoundTimer(roundId, state.drawTimeSecs * 1000),
    wordService.storeRoundWord(roundId, chosen.word),
    gameState.setRoomState(roomId, {
      phase: 'drawing',
      currentRoundId: roundId,
      timerEndMs: 0,
      wordHint: hint,
      wordDifficulty: chosen.difficulty || 'medium',
      clearGeneration: 0,
    }),
    redis.del(REDIS_KEYS.guessed(roundId)),
    redis.del(REDIS_KEYS.wordChoices(roomId)),
  ]);

  await gameState.setRoomState(roomId, { timerEndMs });

  io.to(roomId).emit(EVENTS.ROUND_START, {
    roundId,
    roundNumber: state.currentRound,
    drawerUserId: state.currentDrawerUserId,
    timerEndMs,
    wordLength: chosen.word.length,
    wordHint: hint,
    totalRounds: state.roundCount,
  });

  const drawerSession = await redis.hgetall(REDIS_KEYS.session(state.currentDrawerUserId));
  if (drawerSession?.socketId) {
    io.to(drawerSession.socketId).emit('round:word_reveal', { word: chosen.word });
  }

  withRetry(() => prisma.round.create({
    data: {
      id: roundId,
      roomId,
      roundNumber: state.currentRound,
      drawerUserId: state.currentDrawerUserId,
      team: 'none',
      word: wordService.encryptWord(chosen.word),
      wordDifficulty: chosen.difficulty,
      status: 'drawing',
      startedAt: new Date(),
    },
  })).catch(e => {
    if (e.code !== 'P2002') console.error('[selectWord] DB round create failed:', e.message);
  });

  scheduleHints(io, roomId, roundId, chosen.word, state.drawTimeSecs);
}

function scheduleHints(io, roomId, roundId, word, drawTimeSecs) {
  const schedule = timerService.getHintSchedule(drawTimeSecs);
  for (const { delayMs, threshold } of schedule) {
    setTimeout(async () => {
      const currentState = await gameState.getRoomState(roomId);
      if (currentState?.phase !== 'drawing' || currentState.currentRoundId !== roundId) return;

      const hint = wordService.generateHint(word, threshold);
      await gameState.setRoomState(roomId, { wordHint: hint });
      io.to(roomId).emit(EVENTS.ROUND_HINT_REVEAL, { hintPattern: hint });
    }, delayMs);
  }
}

export async function endRound(io, roomId, roundId) {
  const [state, word, players] = await Promise.all([
    gameState.getRoomState(roomId),
    wordService.getRoundWord(roundId),
    gameState.getPlayers(roomId),
  ]);
  if (!state || state.currentRoundId !== roundId) return;

  const totalGuessers = players.filter(
    p => p.role === 'player' && p.userId !== state.currentDrawerUserId
  ).length;

  const [correctCount] = await Promise.all([
    redis.scard(REDIS_KEYS.guessed(roundId)),
    timerService.clearTimer(roundId),
  ]);

  const drawerScore = scoreService.calculateDrawerScore(correctCount, totalGuessers);

  if (drawerScore > 0 && state.currentDrawerUserId) {
    await gameState.addScore(roomId, state.currentDrawerUserId, drawerScore);
  }

  await gameState.setRoomState(roomId, { phase: 'round_end' });

  const scores = await gameState.getScores(roomId);
  const playerMap = Object.fromEntries(players.map(p => [p.userId, p]));

  const guessedMembers = await redis.smembers(REDIS_KEYS.guessed(roundId));

  io.to(roomId).emit(EVENTS.ROUND_END, {
    word: word || '???',
    scores: scores.map(s => ({
      ...s,
      username: playerMap[s.userId]?.username || 'Unknown',
    })),
    correctGuesses: guessedMembers.map(uid => ({
      userId: uid,
      username: playerMap[uid]?.username || 'Unknown',
    })),
    drawerUserId: state.currentDrawerUserId,
    drawerUsername: playerMap[state.currentDrawerUserId]?.username || 'Unknown',
    drawerScore,
    roundNumber: state.currentRound,
    totalRounds: state.roundCount,
  });

  (async () => {
    try {
      await prisma.round.update({
        where: { id: roundId },
        data: { status: 'finished', endedAt: new Date() },
      }).catch(() => {});

      if (drawerScore > 0 && state.currentDrawerUserId) {
        prisma.roomPlayer.updateMany({
          where: { roomId, userId: state.currentDrawerUserId },
          data: { totalScore: { increment: drawerScore } },
        }).catch(() => {});
      }

      strokeService.flushStrokesToDb(roundId).catch(e =>
        console.error('Stroke flush failed:', e.message)
      );
      saveReplay(roundId).catch(e => console.error('Replay save failed:', e.message));
    } catch (e) {
      console.error('[endRound] background DB error:', e.message);
    }
  })();

  setTimeout(() => startNextRound(io, roomId), GAME.ROUND_END_DELAY_MS);
}

export async function endGame(io, roomId) {
  await gameState.setRoomState(roomId, { status: 'finished', phase: 'game_over' });

  const [scores, players] = await Promise.all([
    gameState.getScores(roomId),
    gameState.getPlayers(roomId),
  ]);
  scores.sort((a, b) => b.score - a.score);

  const playerMap = Object.fromEntries(players.map(p => [p.userId, p]));
  const winnerId = scores[0]?.userId || null;

  io.to(roomId).emit(EVENTS.GAME_END, {
    finalScores: scores.map((s, i) => ({
      ...s,
      rank: i + 1,
      username: playerMap[s.userId]?.username || 'Unknown',
    })),
    winnerId,
  });

  (async () => {
    try {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'finished', endedAt: new Date() },
      });

      for (let i = 0; i < scores.length; i++) {
        const s = scores[i];
        try {
          await prisma.gameResult.create({
            data: {
              roomId,
              userId: s.userId,
              finalRank: i + 1,
              finalScore: s.score,
              scoreDelta: s.score,
            },
          });
          await prisma.user.update({
            where: { id: s.userId },
            data: {
              totalScore: { increment: s.score },
              gamesPlayed: { increment: 1 },
              gamesWon: i === 0 ? { increment: 1 } : undefined,
            },
          });
        } catch (e) {
          if (e.code !== 'P2002') console.error('Game result error:', e);
        }
      }
    } catch (e) {
      console.error('[endGame] background DB error:', e.message);
    }
  })();
}
