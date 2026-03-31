import { redis } from '../index.js';
import { REDIS_KEYS } from '@sketchbattle/shared';
import prisma, { withRetry } from '../lib/prisma.js';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.WORD_ENCRYPTION_KEY;
const WORD_CACHE_KEY = 'game:wordcache';
const WORD_CACHE_SIZE = 60;

export function encryptWord(word) {
  if (!ENCRYPTION_KEY) return word;
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(word, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptWord(encrypted) {
  if (!ENCRYPTION_KEY || !encrypted.includes(':')) return encrypted;
  const [ivHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function refillWordCache(wordPackId) {
  const where = wordPackId
    ? { packId: wordPackId }
    : { pack: { isPublic: true } };

  const totalWords = await withRetry(() => prisma.word.count({ where }));
  if (totalWords === 0) return false;

  const fetchCount = Math.min(WORD_CACHE_SIZE, totalWords);
  const skip = Math.floor(Math.random() * Math.max(0, totalWords - fetchCount));
  const words = await withRetry(() =>
    prisma.word.findMany({ where, skip, take: fetchCount })
  );

  if (words.length === 0) return false;

  const pipeline = redis.pipeline();
  pipeline.del(WORD_CACHE_KEY);
  for (const w of words) {
    pipeline.rpush(WORD_CACHE_KEY, JSON.stringify({
      id: w.id, word: w.word, difficulty: w.difficulty,
    }));
  }
  pipeline.expire(WORD_CACHE_KEY, 600);
  await pipeline.exec();
  return true;
}

export async function pickWordChoices(wordPackId, count = 3) {
  let cacheLen = await redis.llen(WORD_CACHE_KEY);

  if (cacheLen < count) {
    const filled = await refillWordCache(wordPackId);
    if (!filled) {
      return [{ id: 'fallback', word: 'cat', difficulty: 'easy' }];
    }
    cacheLen = await redis.llen(WORD_CACHE_KEY);
  }

  const words = [];
  const indices = new Set();
  while (indices.size < Math.min(count, cacheLen)) {
    indices.add(Math.floor(Math.random() * cacheLen));
  }

  const pipeline = redis.pipeline();
  for (const idx of indices) {
    pipeline.lindex(WORD_CACHE_KEY, idx);
  }
  const results = await pipeline.exec();

  for (const [err, raw] of results) {
    if (!err && raw) {
      try { words.push(JSON.parse(raw)); } catch {}
    }
  }

  if (words.length === 0) {
    return [{ id: 'fallback', word: 'cat', difficulty: 'easy' }];
  }

  return words;
}

export async function storeRoundWord(roundId, word, team = 'none') {
  const key = team !== 'none'
    ? REDIS_KEYS.wordTeam(roundId, team)
    : REDIS_KEYS.word(roundId);
  await redis.set(key, word, 'EX', 300);
}

export async function getRoundWord(roundId, team = 'none') {
  const key = team !== 'none'
    ? REDIS_KEYS.wordTeam(roundId, team)
    : REDIS_KEYS.word(roundId);
  return redis.get(key);
}

export function generateHint(word, revealFraction) {
  const chars = word.split('');
  const letterIndices = chars
    .map((c, i) => (c !== ' ' ? i : -1))
    .filter(i => i !== -1);

  const revealCount = Math.floor(letterIndices.length * revealFraction);
  const shuffled = letterIndices.sort(() => Math.random() - 0.5);
  const revealed = new Set(shuffled.slice(0, revealCount));

  return chars
    .map((c, i) => {
      if (c === ' ') return '  ';
      return revealed.has(i) ? c : '_';
    })
    .join(' ');
}

export function generateInitialHint(word) {
  return word
    .split('')
    .map(c => (c === ' ' ? '  ' : '_'))
    .join(' ');
}
