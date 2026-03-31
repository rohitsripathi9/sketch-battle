import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable, Writable } from 'stream';
import prisma from '../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPLAY_DIR = path.join(__dirname, '..', '..', '..', '..', 'replays');

async function ensureReplayDir() {
  await fs.mkdir(REPLAY_DIR, { recursive: true });
}

export async function saveReplay(roundId) {
  try {
    await ensureReplayDir();

    const strokes = await prisma.stroke.findMany({
      where: { roundId },
      orderBy: { sequence: 'asc' },
      select: { sequence: true, opType: true, payload: true, createdAt: true },
    });

    if (strokes.length === 0) return null;

    const guesses = await prisma.guess.findMany({
      where: { roundId },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true, guessText: true, isCorrect: true,
        scoreAwarded: true, guessedAtElapsedMs: true,
        user: { select: { username: true } },
      },
    });

    const replayData = JSON.stringify({ strokes, guesses });
    const compressed = await gzipString(replayData);

    const filename = `${roundId}.json.gz`;
    const filepath = path.join(REPLAY_DIR, filename);
    await fs.writeFile(filepath, compressed);

    await prisma.round.update({
      where: { id: roundId },
      data: { replayS3Key: `local:${filename}` },
    });

    return filename;
  } catch (err) {
    console.error('Replay save error:', err);
    return null;
  }
}

export async function loadReplay(roundId) {
  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { replayS3Key: true },
    });

    if (!round?.replayS3Key) return null;

    if (round.replayS3Key.startsWith('local:')) {
      const filename = round.replayS3Key.replace('local:', '');
      const filepath = path.join(REPLAY_DIR, filename);
      const compressed = await fs.readFile(filepath);
      const json = await gunzipToString(compressed);
      return JSON.parse(json);
    }

    return null;
  } catch (err) {
    console.error('Replay load error:', err);
    return null;
  }
}

function gzipString(str) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const gzip = createGzip();
    gzip.on('data', chunk => chunks.push(chunk));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));
    gzip.on('error', reject);
    gzip.write(str);
    gzip.end();
  });
}

function gunzipToString(buffer) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const gunzip = createGunzip();
    gunzip.on('data', chunk => chunks.push(chunk));
    gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    gunzip.on('error', reject);
    gunzip.write(buffer);
    gunzip.end();
  });
}
