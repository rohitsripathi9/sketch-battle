import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadReplay } from '../services/replayService.js';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/:roundId', requireAuth, async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: {
        room: {
          include: {
            players: { where: { userId: req.user.userId }, select: { id: true } },
          },
        },
      },
    });

    if (!round) return res.status(404).json({ error: 'Round not found' });

    if (round.room.players.length === 0) {
      return res.status(403).json({ error: 'You were not in this game' });
    }

    const replay = await loadReplay(req.params.roundId);
    if (!replay) return res.status(404).json({ error: 'Replay not available' });

    res.json({ replay });
  } catch (err) {
    console.error('Replay fetch error:', err);
    res.status(500).json({ error: 'Failed to load replay' });
  }
});

router.get('/room/:roomId', requireAuth, async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { roomId: req.params.roomId },
      orderBy: { roundNumber: 'asc' },
      select: {
        id: true, roundNumber: true, team: true,
        wordDifficulty: true, status: true, replayS3Key: true,
        drawer: { select: { username: true } },
      },
    });

    res.json({
      rounds: rounds.map(r => ({
        ...r,
        hasReplay: !!r.replayS3Key,
        drawerName: r.drawer?.username,
      })),
    });
  } catch (err) {
    console.error('Room replays error:', err);
    res.status(500).json({ error: 'Failed to list replays' });
  }
});

export default router;
