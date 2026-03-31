import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma, { withRetry } from '../lib/prisma.js';
import { GAME } from '@sketchbattle/shared';

const router = Router();

// ─── Generate unique 6-char room code ────────────────────
async function generateRoomCode() {
  const chars = GAME.CODE_CHARS;
  let attempts = 0;
  while (attempts < 10) {
    let code = '';
    for (let i = 0; i < GAME.CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const exists = await withRetry(() => prisma.room.findUnique({ where: { code } }));
    if (!exists) return code;
    attempts++;
  }
  throw new Error('Failed to generate unique room code');
}

// ─── POST /api/rooms — Create room ──────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      mode = 'matchmaking',
      maxPlayers = GAME.DEFAULT_MAX_PLAYERS,
      roundCount = GAME.DEFAULT_ROUNDS,
      drawTimeSecs = GAME.DEFAULT_DRAW_TIME,
      wordPackId = null,
      password = null,
      allowSpectators = true,
    } = req.body;

    // Validate mode
    if (!['matchmaking', 'dual_battle', 'private'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid game mode' });
    }

    // Validate limits
    if (maxPlayers < GAME.MIN_PLAYERS || maxPlayers > GAME.MAX_PLAYERS) {
      return res.status(400).json({ error: `Max players must be ${GAME.MIN_PLAYERS}-${GAME.MAX_PLAYERS}` });
    }
    if (roundCount < GAME.MIN_ROUNDS || roundCount > GAME.MAX_ROUNDS) {
      return res.status(400).json({ error: `Round count must be ${GAME.MIN_ROUNDS}-${GAME.MAX_ROUNDS}` });
    }
    if (drawTimeSecs < GAME.MIN_DRAW_TIME || drawTimeSecs > GAME.MAX_DRAW_TIME) {
      return res.status(400).json({ error: `Draw time must be ${GAME.MIN_DRAW_TIME}-${GAME.MAX_DRAW_TIME}s` });
    }

    // 2v2 battle is always exactly 4 players
    if (mode === 'dual_battle') {
      req.body.maxPlayers = 4;
    }

    const code = await generateRoomCode();

    let passwordHash = null;
    if (mode === 'private' && password) {
      const bcrypt = await import('bcrypt');
      passwordHash = await bcrypt.hash(password, 12);
    }

    const finalMaxPlayers = mode === 'dual_battle' ? 4 : maxPlayers;

    const room = await withRetry(() => prisma.room.create({
      data: {
        code,
        mode,
        hostUserId: req.user.userId,
        maxPlayers: finalMaxPlayers,
        roundCount,
        drawTimeSecs: mode === 'dual_battle' ? 60 : drawTimeSecs,
        wordPackId,
        passwordHash,
        allowSpectators,
      },
    }));

    res.status(201).json({
      room: {
        id: room.id,
        code: room.code,
        mode: room.mode,
        maxPlayers: room.maxPlayers,
        roundCount: room.roundCount,
        drawTimeSecs: room.drawTimeSecs,
        allowSpectators: room.allowSpectators,
        status: room.status,
      },
    });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ─── GET /api/rooms/public — List open rooms ─────────────
router.get('/public', async (req, res) => {
  try {
    const rooms = await withRetry(() => prisma.room.findMany({
      where: {
        mode: 'matchmaking',
        status: 'waiting',
      },
      include: {
        _count: { select: { players: { where: { leftAt: null } } } },
        host: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }));

    const roomList = rooms
      .filter((r) => r._count.players < r.maxPlayers)
      .map((r) => ({
        id: r.id,
        code: r.code,
        hostName: r.host?.username || 'Unknown',
        playerCount: r._count.players,
        maxPlayers: r.maxPlayers,
        roundCount: r.roundCount,
        drawTimeSecs: r.drawTimeSecs,
      }));

    res.json({ rooms: roomList });
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

// ─── GET /api/rooms/:code — Room info ────────────────────
router.get('/:code', async (req, res) => {
  try {
    const room = await withRetry(() => prisma.room.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: {
        _count: { select: { players: { where: { leftAt: null } } } },
        host: { select: { username: true } },
      },
    }));

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      room: {
        id: room.id,
        code: room.code,
        mode: room.mode,
        hostName: room.host?.username || 'Unknown',
        playerCount: room._count.players,
        maxPlayers: room.maxPlayers,
        roundCount: room.roundCount,
        drawTimeSecs: room.drawTimeSecs,
        allowSpectators: room.allowSpectators,
        status: room.status,
        hasPassword: !!room.passwordHash,
      },
    });
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// ─── POST /api/rooms/:code/join — Join with password ────
router.post('/:code/join', requireAuth, async (req, res) => {
  try {
    const room = await withRetry(() => prisma.room.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: { _count: { select: { players: { where: { leftAt: null } } } } },
    }));

    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'finished' || room.status === 'abandoned') {
      return res.status(400).json({ error: 'Room is no longer active' });
    }

    if (room._count.players >= room.maxPlayers) {
      return res.status(400).json({ error: 'Room is full' });
    }

    if (room.passwordHash) {
      const { password } = req.body;
      if (!password) return res.status(401).json({ error: 'Password required' });
      const bcryptMod = await import('bcrypt');
      const valid = await bcryptMod.compare(password, room.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Wrong password' });
    }

    res.json({
      room: {
        id: room.id,
        code: room.code,
        mode: room.mode,
        maxPlayers: room.maxPlayers,
        status: room.status,
      },
    });
  } catch (err) {
    console.error('Join room error:', err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

export default router;
