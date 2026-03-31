import crypto from 'crypto';
import { EVENTS, REDIS_KEYS, GAME } from '@sketchbattle/shared';
import { redis } from '../index.js';
import prisma, { withRetry } from '../lib/prisma.js';
import * as gameState from '../services/gameStateService.js';
import * as wordService from '../services/wordService.js';
import * as timerService from '../services/timerService.js';
import * as strokeService from '../services/strokeService.js';
import * as scoreService from '../services/scoreService.js';

const DUAL_DRAW_TIME = 60;

export async function startDualBattle(io, roomId, room) {
  const players = await gameState.getPlayers(roomId);
  const redPlayers = players.filter(p => p.team === 'red' && p.role === 'player');
  const bluePlayers = players.filter(p => p.team === 'blue' && p.role === 'player');

  if (redPlayers.length !== 2 || bluePlayers.length !== 2) {
    io.to(roomId).emit(EVENTS.ERROR, { message: '2v2 requires exactly 2 players per team (4 total)' });
    return;
  }

  const pipeline = redis.pipeline();
  for (const p of [...redPlayers, ...bluePlayers]) {
    pipeline.zadd(REDIS_KEYS.scores(roomId), 0, p.userId);
  }
  pipeline.expire(REDIS_KEYS.scores(roomId), 86400);
  await pipeline.exec();

  await gameState.setRoomState(roomId, {
    status: 'in_progress',
    mode: 'dual_battle',
    currentRound: 0,
    roundCount: room.roundCount,
    drawTimeSecs: DUAL_DRAW_TIME,
    phase: 'idle',
    clearGeneration: 0,
    dualRedDrawerIndex: 0,
    dualBlueDrawerIndex: 0,
    wordPackId: room.wordPackId || '',
  });

  prisma.room.update({
    where: { id: roomId },
    data: { status: 'in_progress', startedAt: new Date() },
  }).catch(e => console.error('[startDualBattle] DB update:', e.message));

  for (const p of redPlayers) {
    const session = await redis.hgetall(REDIS_KEYS.session(p.userId));
    if (session?.socketId) {
      const sock = io.sockets.sockets.get(session.socketId);
      if (sock) sock.join(`${roomId}:red`);
    }
  }
  for (const p of bluePlayers) {
    const session = await redis.hgetall(REDIS_KEYS.session(p.userId));
    if (session?.socketId) {
      const sock = io.sockets.sockets.get(session.socketId);
      if (sock) sock.join(`${roomId}:blue`);
    }
  }

  io.to(roomId).emit(EVENTS.GAME_STARTED, {
    roundCount: room.roundCount,
    drawTimeSecs: DUAL_DRAW_TIME,
    playerCount: 4,
    mode: 'dual_battle',
  });

  await startDualRound(io, roomId);
}

async function startDualRound(io, roomId) {
  const [state, players] = await Promise.all([
    gameState.getRoomState(roomId),
    gameState.getPlayers(roomId),
  ]);
  if (!state) return;

  const nextRound = state.currentRound + 1;
  if (nextRound > state.roundCount) {
    await endDualSession(io, roomId);
    return;
  }

  const redPlayers = players.filter(p => p.team === 'red' && p.role === 'player').sort((a, b) => a.seatOrder - b.seatOrder);
  const bluePlayers = players.filter(p => p.team === 'blue' && p.role === 'player').sort((a, b) => a.seatOrder - b.seatOrder);

  if (redPlayers.length < 2 || bluePlayers.length < 2) {
    await endDualSession(io, roomId);
    return;
  }

  const redDrawerIndex = (nextRound - 1) % redPlayers.length;
  const blueDrawerIndex = (nextRound - 1) % bluePlayers.length;
  const redDrawer = redPlayers[redDrawerIndex];
  const blueDrawer = bluePlayers[blueDrawerIndex];
  const redGuesser = redPlayers.find(p => p.userId !== redDrawer.userId);
  const blueGuesser = bluePlayers.find(p => p.userId !== blueDrawer.userId);

  const wordChoices = await wordService.pickWordChoices(state.wordPackId || null, 1);
  const chosen = wordChoices[0];

  const redRoundId = crypto.randomUUID();
  const blueRoundId = crypto.randomUUID();

  const hint = wordService.generateInitialHint(chosen.word);

  const [timerEndMs] = await Promise.all([
    timerService.startRoundTimer(redRoundId, DUAL_DRAW_TIME * 1000),
    timerService.startRoundTimer(blueRoundId, DUAL_DRAW_TIME * 1000),
    wordService.storeRoundWord(redRoundId, chosen.word, 'red'),
    wordService.storeRoundWord(blueRoundId, chosen.word, 'blue'),
    wordService.storeRoundWord(redRoundId, chosen.word),
    wordService.storeRoundWord(blueRoundId, chosen.word),
    redis.del(REDIS_KEYS.guessed(redRoundId)),
    redis.del(REDIS_KEYS.guessed(blueRoundId)),
  ]);

  await gameState.setRoomState(roomId, {
    currentRound: nextRound,
    phase: 'drawing',
    timerEndMs,
    wordHint: hint,
    currentRoundIdRed: redRoundId,
    currentRoundIdBlue: blueRoundId,
    currentRoundId: redRoundId,
    dualRedDrawerId: redDrawer.userId,
    dualBlueDrawerId: blueDrawer.userId,
    wordDifficulty: chosen.difficulty || 'medium',
  });

  const roundPayload = {
    roundNumber: nextRound, timerEndMs,
    wordLength: chosen.word.length, wordHint: hint,
    totalRounds: state.roundCount,
  };

  io.to(`${roomId}:red`).emit(EVENTS.ROUND_START, {
    ...roundPayload,
    roundId: redRoundId,
    drawerUserId: redDrawer.userId,
    drawerUsername: redDrawer.username,
    guesserUserId: redGuesser?.userId,
    guesserUsername: redGuesser?.username,
    team: 'red',
  });
  io.to(`${roomId}:blue`).emit(EVENTS.ROUND_START, {
    ...roundPayload,
    roundId: blueRoundId,
    drawerUserId: blueDrawer.userId,
    drawerUsername: blueDrawer.username,
    guesserUserId: blueGuesser?.userId,
    guesserUsername: blueGuesser?.username,
    team: 'blue',
  });

  const [redSession, blueSession] = await Promise.all([
    redis.hgetall(REDIS_KEYS.session(redDrawer.userId)),
    redis.hgetall(REDIS_KEYS.session(blueDrawer.userId)),
  ]);
  if (redSession?.socketId) io.to(redSession.socketId).emit('round:word_reveal', { word: chosen.word });
  if (blueSession?.socketId) io.to(blueSession.socketId).emit('round:word_reveal', { word: chosen.word });

  const difficulty = chosen.difficulty || 'medium';
  Promise.all([
    withRetry(() => prisma.round.create({
      data: {
        id: redRoundId, roomId, roundNumber: nextRound, drawerUserId: redDrawer.userId,
        team: 'red', word: wordService.encryptWord(chosen.word),
        wordDifficulty: difficulty, status: 'drawing', startedAt: new Date(),
      },
    })).catch(e => { if (e.code !== 'P2002') console.error('[dualRound] red create:', e.message); }),
    withRetry(() => prisma.round.create({
      data: {
        id: blueRoundId, roomId, roundNumber: nextRound, drawerUserId: blueDrawer.userId,
        team: 'blue', word: wordService.encryptWord(chosen.word),
        wordDifficulty: difficulty, status: 'drawing', startedAt: new Date(),
      },
    })).catch(e => { if (e.code !== 'P2002') console.error('[dualRound] blue create:', e.message); }),
  ]);

  scheduleHints(io, roomId, redRoundId, blueRoundId, chosen.word, nextRound);

  setTimeout(async () => {
    const current = await gameState.getRoomState(roomId);
    if (current?.phase === 'drawing' && current.currentRound === nextRound) {
      await endDualRound(io, roomId);
    }
  }, DUAL_DRAW_TIME * 1000);
}

function scheduleHints(io, roomId, redRoundId, blueRoundId, word, roundNumber) {
  const totalMs = DUAL_DRAW_TIME * 1000;
  for (const threshold of GAME.HINT_THRESHOLDS) {
    const delayMs = Math.floor(totalMs * threshold);
    setTimeout(async () => {
      const currentState = await gameState.getRoomState(roomId);
      if (currentState?.phase !== 'drawing' || currentState.currentRound !== roundNumber) return;

      const hint = wordService.generateHint(word, threshold);
      await gameState.setRoomState(roomId, { wordHint: hint });
      io.to(`${roomId}:red`).emit(EVENTS.ROUND_HINT_REVEAL, { hintPattern: hint });
      io.to(`${roomId}:blue`).emit(EVENTS.ROUND_HINT_REVEAL, { hintPattern: hint });
    }, delayMs);
  }
}

async function endDualRound(io, roomId) {
  const [state, players] = await Promise.all([
    gameState.getRoomState(roomId),
    gameState.getPlayers(roomId),
  ]);
  if (!state || state.phase !== 'drawing') return;

  const redRoundId = state.currentRoundIdRed;
  const blueRoundId = state.currentRoundIdBlue;

  const [word, redCount, blueCount, scores] = await Promise.all([
    redRoundId ? wordService.getRoundWord(redRoundId) : '???',
    redis.get(REDIS_KEYS.dualWordCount(roomId, 'red')),
    redis.get(REDIS_KEYS.dualWordCount(roomId, 'blue')),
    gameState.getScores(roomId),
    redRoundId ? timerService.clearTimer(redRoundId) : null,
    blueRoundId ? timerService.clearTimer(blueRoundId) : null,
  ]);

  await gameState.setRoomState(roomId, { phase: 'round_end' });
  const playerMap = Object.fromEntries(players.map(p => [p.userId, p]));

  io.to(roomId).emit(EVENTS.DUAL_ROUND_END, {
    word: word || '???',
    redWordCount: parseInt(redCount) || 0,
    blueWordCount: parseInt(blueCount) || 0,
    scores: scores.map(s => ({ ...s, username: playerMap[s.userId]?.username || 'Unknown', team: playerMap[s.userId]?.team })),
    roundNumber: state.currentRound,
    totalRounds: state.roundCount,
    redDrawerId: state.dualRedDrawerId,
    blueDrawerId: state.dualBlueDrawerId,
  });

  (async () => {
    try {
      if (redRoundId) {
        prisma.round.update({ where: { id: redRoundId }, data: { status: 'finished', endedAt: new Date() } }).catch(() => {});
        strokeService.flushStrokesToDb(redRoundId).catch(() => {});
      }
      if (blueRoundId) {
        prisma.round.update({ where: { id: blueRoundId }, data: { status: 'finished', endedAt: new Date() } }).catch(() => {});
        strokeService.flushStrokesToDb(blueRoundId).catch(() => {});
      }
    } catch (e) {
      console.error('[endDualRound] bg error:', e.message);
    }
  })();

  setTimeout(() => startDualRound(io, roomId), GAME.ROUND_END_DELAY_MS);
}

async function endDualSession(io, roomId) {
  await gameState.setRoomState(roomId, { status: 'finished', phase: 'game_over' });

  const [scores, players] = await Promise.all([
    gameState.getScores(roomId),
    gameState.getPlayers(roomId),
  ]);
  scores.sort((a, b) => b.score - a.score);

  const playerMap = Object.fromEntries(players.map(p => [p.userId, p]));

  let redTotal = 0, blueTotal = 0;
  for (const s of scores) {
    const team = playerMap[s.userId]?.team;
    if (team === 'red') redTotal += s.score;
    else if (team === 'blue') blueTotal += s.score;
  }

  const [redCountRaw, blueCountRaw] = await Promise.all([
    redis.get(REDIS_KEYS.dualWordCount(roomId, 'red')),
    redis.get(REDIS_KEYS.dualWordCount(roomId, 'blue')),
  ]);

  io.to(roomId).emit(EVENTS.DUAL_SESSION_END, {
    winnerTeam: redTotal > blueTotal ? 'red' : blueTotal > redTotal ? 'blue' : 'tie',
    redTotal, blueTotal,
    redWordCount: parseInt(redCountRaw) || 0,
    blueWordCount: parseInt(blueCountRaw) || 0,
    finalScores: scores.map((s, i) => ({
      ...s, rank: i + 1, username: playerMap[s.userId]?.username || 'Unknown',
      team: playerMap[s.userId]?.team,
    })),
  });

  (async () => {
    try {
      await prisma.room.update({ where: { id: roomId }, data: { status: 'finished', endedAt: new Date() } });
      for (let i = 0; i < scores.length; i++) {
        try {
          await prisma.gameResult.create({
            data: { roomId, userId: scores[i].userId, finalRank: i + 1, finalScore: scores[i].score, scoreDelta: scores[i].score },
          });
          await prisma.user.update({
            where: { id: scores[i].userId },
            data: { totalScore: { increment: scores[i].score }, gamesPlayed: { increment: 1 } },
          });
        } catch (e) { if (e.code !== 'P2002') console.error(e); }
      }
    } catch (e) {
      console.error('[endDualSession] bg error:', e.message);
    }
  })();
}

export async function handleDualGuess(io, socket, state, guessText, player) {
  const team = player.team;
  if (!team || team === 'none') return;

  const drawerId = team === 'red' ? state.dualRedDrawerId : state.dualBlueDrawerId;
  if (socket.userId === drawerId) return;

  const roundId = team === 'red' ? state.currentRoundIdRed : state.currentRoundIdBlue;
  if (!roundId) return;

  const alreadyGuessed = await redis.sismember(REDIS_KEYS.guessed(roundId), socket.userId);
  if (alreadyGuessed) {
    io.to(`${socket.roomId}:${team}`).emit(EVENTS.CHAT_MESSAGE, {
      userId: socket.userId, username: socket.username, text: guessText, timestamp: Date.now(), isGuess: false,
    });
    return;
  }

  const word = await wordService.getRoundWord(roundId);
  if (!word) return;

  const isCorrect = guessText.toLowerCase() === word.toLowerCase();

  if (!isCorrect) {
    io.to(`${socket.roomId}:${team}`).emit(EVENTS.CHAT_MESSAGE, {
      userId: socket.userId, username: socket.username, text: guessText, timestamp: Date.now(),
      isGuess: true, isClose: isCloseGuess(guessText, word),
    });
    return;
  }

  const [, , remainingMs] = await Promise.all([
    redis.sadd(REDIS_KEYS.guessed(roundId), socket.userId),
    redis.incr(REDIS_KEYS.dualWordCount(socket.roomId, team)),
    timerService.getRemainingMs(roundId),
  ]);
  redis.expire(REDIS_KEYS.dualWordCount(socket.roomId, team), 86400);

  const totalMs = DUAL_DRAW_TIME * 1000;
  const difficulty = state.wordDifficulty || 'medium';

  const score = scoreService.calculateDualScore({
    remainingMs, totalMs, difficulty,
  });

  const drawerScore = Math.floor(score * 0.5);

  await Promise.all([
    gameState.addScore(socket.roomId, socket.userId, score),
    drawerId ? gameState.addScore(socket.roomId, drawerId, drawerScore) : null,
  ]);

  const wordCount = await redis.get(REDIS_KEYS.dualWordCount(socket.roomId, team));

  io.to(socket.roomId).emit(EVENTS.DUAL_WORD_GUESSED, {
    team, wordCount: parseInt(wordCount) || 0, word,
    userId: socket.userId, username: socket.username, score,
    drawerId, drawerScore,
  });

  const [updatedScores, allPlayers] = await Promise.all([
    gameState.getScores(socket.roomId),
    gameState.getPlayers(socket.roomId),
  ]);
  const pMap = Object.fromEntries(allPlayers.map(p => [p.userId, p]));
  io.to(socket.roomId).emit(EVENTS.SCORE_UPDATE, {
    scores: updatedScores.map(s => ({ ...s, username: pMap[s.userId]?.username || 'Unknown', team: pMap[s.userId]?.team })),
  });

  prisma.guess.create({
    data: { roundId, userId: socket.userId, team, guessText, isCorrect: true, scoreAwarded: score, guessedAtElapsedMs: Math.floor(totalMs - remainingMs) },
  }).catch(e => { if (e.code !== 'P2002') console.error('[dualGuess] DB:', e.message); });

  const otherTeam = team === 'red' ? 'blue' : 'red';
  const otherRoundId = otherTeam === 'red' ? state.currentRoundIdRed : state.currentRoundIdBlue;
  const otherGuessed = otherRoundId ? await redis.scard(REDIS_KEYS.guessed(otherRoundId)) : 0;

  if (otherGuessed > 0) {
    setTimeout(async () => {
      const current = await gameState.getRoomState(socket.roomId);
      if (current?.phase === 'drawing' && current.currentRound === state.currentRound) {
        await endDualRound(io, socket.roomId);
      }
    }, 2000);
  }
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
