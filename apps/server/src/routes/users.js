import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ─── GET /api/users/me — Own profile ─────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        totalScore: true,
        gamesPlayed: true,
        gamesWon: true,
        isGuest: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        ...user,
        totalScore: user.totalScore.toString(),
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ─── GET /api/users/:id — Public profile ─────────────────
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        totalScore: true,
        gamesPlayed: true,
        gamesWon: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        ...user,
        totalScore: user.totalScore.toString(),
      },
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ─── GET /api/leaderboard — Top 100 ─────────────────────
router.get('/leaderboard/top', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isBanned: false, isGuest: false },
      select: {
        id: true,
        username: true,
        totalScore: true,
        gamesPlayed: true,
        gamesWon: true,
      },
      orderBy: { totalScore: 'desc' },
      take: 100,
    });

    res.json({
      leaderboard: users.map((u, i) => ({
        rank: i + 1,
        ...u,
        totalScore: u.totalScore.toString(),
      })),
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

export default router;
