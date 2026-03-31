import { redis } from '../index.js';
import { REDIS_KEYS, GAME } from '@sketchbattle/shared';

export async function startRoundTimer(roundId, durationMs) {
  const endMs = Date.now() + durationMs;
  await redis.set(REDIS_KEYS.timer(roundId), String(endMs), 'PX', durationMs + 10000);
  return endMs;
}

export async function getTimerEnd(roundId) {
  const val = await redis.get(REDIS_KEYS.timer(roundId));
  return val ? parseInt(val) : null;
}

export async function clearTimer(roundId) {
  await redis.del(REDIS_KEYS.timer(roundId));
}

export async function getRemainingMs(roundId) {
  const endMs = await getTimerEnd(roundId);
  if (!endMs) return 0;
  return Math.max(0, endMs - Date.now());
}

export function getHintSchedule(drawTimeSecs) {
  const totalMs = drawTimeSecs * 1000;
  return GAME.HINT_THRESHOLDS.map(threshold => ({
    threshold,
    delayMs: Math.floor(totalMs * threshold),
  }));
}
