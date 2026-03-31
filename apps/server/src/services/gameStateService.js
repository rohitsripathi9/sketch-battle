import { redis } from '../index.js';
import { REDIS_KEYS } from '@sketchbattle/shared';

export async function getRoomState(roomId) {
  const state = await redis.hgetall(REDIS_KEYS.room(roomId));
  if (!state || !state.status) return null;
  return {
    status: state.status,
    mode: state.mode,
    currentRound: parseInt(state.currentRound) || 0,
    currentDrawerUserId: state.currentDrawerUserId || null,
    phase: state.phase || null,
    timerEndMs: state.timerEndMs ? parseInt(state.timerEndMs) : null,
    wordHint: state.wordHint || null,
    roundCount: parseInt(state.roundCount) || 3,
    drawTimeSecs: parseInt(state.drawTimeSecs) || 80,
    clearGeneration: parseInt(state.clearGeneration) || 0,
    currentRoundId: state.currentRoundId || null,
    currentRoundIdRed: state.currentRoundIdRed || null,
    currentRoundIdBlue: state.currentRoundIdBlue || null,
    dualRedDrawerId: state.dualRedDrawerId || null,
    dualBlueDrawerId: state.dualBlueDrawerId || null,
    drawerSeatIndex: parseInt(state.drawerSeatIndex) || 0,
    wordPackId: state.wordPackId || null,
    wordDifficulty: state.wordDifficulty || null,
  };
}

export async function setRoomState(roomId, state) {
  const flat = {};
  for (const [k, v] of Object.entries(state)) {
    if (v !== undefined && v !== null) flat[k] = String(v);
  }
  if (Object.keys(flat).length > 0) {
    const pipe = redis.pipeline();
    pipe.hset(REDIS_KEYS.room(roomId), flat);
    pipe.expire(REDIS_KEYS.room(roomId), 86400);
    await pipe.exec();
  }
}

export async function getPlayers(roomId) {
  const raw = await redis.hgetall(REDIS_KEYS.roomPlayers(roomId));
  return Object.entries(raw).map(([userId, json]) => ({
    userId,
    ...JSON.parse(json),
  }));
}

export async function getPlayer(roomId, userId) {
  const raw = await redis.hget(REDIS_KEYS.roomPlayers(roomId), userId);
  if (!raw) return null;
  return { userId, ...JSON.parse(raw) };
}

export async function updatePlayer(roomId, userId, updates) {
  const raw = await redis.hget(REDIS_KEYS.roomPlayers(roomId), userId);
  if (!raw) return null;
  const player = { ...JSON.parse(raw), ...updates };
  await redis.hset(REDIS_KEYS.roomPlayers(roomId), userId, JSON.stringify(player));
  return player;
}

export async function getScores(roomId) {
  const members = await redis.zrevrangebyscore(
    REDIS_KEYS.scores(roomId), '+inf', '-inf', 'WITHSCORES'
  );
  const scores = [];
  for (let i = 0; i < members.length; i += 2) {
    scores.push({ userId: members[i], score: parseInt(members[i + 1]) });
  }
  return scores;
}

export async function addScore(roomId, userId, points) {
  const pipe = redis.pipeline();
  pipe.zincrby(REDIS_KEYS.scores(roomId), points, userId);
  pipe.expire(REDIS_KEYS.scores(roomId), 86400);
  await pipe.exec();
}
