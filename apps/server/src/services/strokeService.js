import { redis } from '../index.js';
import { REDIS_KEYS, GAME } from '@sketchbattle/shared';
import prisma from '../lib/prisma.js';

export async function addStroke(roundId, opType, payload) {
  const seq = await redis.incr(REDIS_KEYS.strokeSeq(roundId));
  const stroke = { seq, opType, payload, ts: Date.now() };
  await redis.lpush(REDIS_KEYS.strokes(roundId), JSON.stringify(stroke));
  await redis.ltrim(REDIS_KEYS.strokes(roundId), 0, GAME.MAX_STROKES_REDIS - 1);
  await redis.expire(REDIS_KEYS.strokes(roundId), 21600);
  await redis.expire(REDIS_KEYS.strokeSeq(roundId), 21600);
  return seq;
}

export async function getStrokes(roundId, fromSeq = 0) {
  const raw = await redis.lrange(REDIS_KEYS.strokes(roundId), 0, -1);
  let strokes = raw.map(s => JSON.parse(s)).reverse();

  if (fromSeq > 0) {
    strokes = strokes.filter(s => s.seq > fromSeq);
  }

  const invalidated = await getInvalidatedSeqs(roundId);
  if (invalidated.size > 0) {
    strokes = strokes.filter(s => !invalidated.has(s.seq));
  }

  if (fromSeq > 0 && strokes.length === 0) {
    return getStrokesFromDb(roundId, fromSeq);
  }

  return strokes;
}

async function getStrokesFromDb(roundId, fromSeq = 0) {
  const dbStrokes = await prisma.stroke.findMany({
    where: {
      roundId,
      sequence: fromSeq > 0 ? { gt: fromSeq } : undefined,
    },
    orderBy: { sequence: 'asc' },
  });

  const invalidated = await getInvalidatedSeqs(roundId);
  return dbStrokes
    .filter(s => !invalidated.has(s.sequence))
    .map(s => ({
      seq: s.sequence,
      opType: s.opType,
      payload: s.payload,
      ts: s.createdAt.getTime(),
    }));
}

export async function invalidateStroke(roundId, targetSeq) {
  await redis.sadd(`game:invalidated:${roundId}`, String(targetSeq));
  await redis.expire(`game:invalidated:${roundId}`, 21600);
}

export async function getInvalidatedSeqs(roundId) {
  const members = await redis.smembers(`game:invalidated:${roundId}`);
  return new Set(members.map(Number));
}

export async function clearStrokes(roundId) {
  await redis.del(REDIS_KEYS.strokes(roundId));
  await redis.del(`game:invalidated:${roundId}`);
}

export async function getClearGeneration(roundId) {
  const val = await redis.get(`game:cleargen:${roundId}`);
  return parseInt(val) || 0;
}

export async function incrementClearGeneration(roundId) {
  const gen = await redis.incr(`game:cleargen:${roundId}`);
  await redis.expire(`game:cleargen:${roundId}`, 21600);
  return gen;
}

export async function flushStrokesToDb(roundId) {
  const raw = await redis.lrange(REDIS_KEYS.strokes(roundId), 0, -1);
  if (raw.length === 0) return 0;

  const strokes = raw.map(s => JSON.parse(s)).reverse();
  const invalidated = await getInvalidatedSeqs(roundId);

  const existing = await prisma.stroke.findMany({
    where: { roundId },
    select: { sequence: true },
  });
  const existingSeqs = new Set(existing.map(s => s.sequence));

  const toInsert = strokes.filter(
    s => !existingSeqs.has(s.seq) && !invalidated.has(s.seq)
  );

  if (toInsert.length === 0) return 0;

  await prisma.stroke.createMany({
    data: toInsert.map(s => ({
      roundId,
      sequence: s.seq,
      opType: s.opType,
      payload: s.payload,
    })),
    skipDuplicates: true,
  });

  return toInsert.length;
}
