import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma, { withRetry } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyToken, requireAuth } from '../middleware/auth.js';
import { redis } from '../index.js';

const router = Router();
const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_DAYS = 7;

// ─── Helper: hash refresh token for storage ──────────────
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── Helper: set refresh token cookie ────────────────────
function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

// ─── Helper: generate room code style username for guests
function generateGuestName() {
  const adjectives = ['Swift', 'Bold', 'Clever', 'Lucky', 'Brave', 'Quick', 'Witty', 'Sly'];
  const nouns = ['Fox', 'Bear', 'Wolf', 'Hawk', 'Lion', 'Lynx', 'Crow', 'Deer'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${adj}${noun}${num}`;
}

// ─── POST /api/auth/register ─────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (username.length > 32) {
      return res.status(400).json({ error: 'Username must be 32 characters or less' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await withRetry(() => prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        passwordHash,
      },
    }));

    // Generate tokens
    const accessToken = signAccessToken({ userId: user.id, username: user.username });
    const refreshTokenRaw = crypto.randomUUID();
    const refreshTokenHashed = hashToken(refreshTokenRaw);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHashed,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
        deviceHint: req.headers['user-agent']?.substring(0, 64) || null,
      },
    });

    setRefreshCookie(res, refreshTokenRaw);

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isGuest: user.isGuest,
      },
      accessToken,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.includes('email') ? 'email' : 'username';
      return res.status(409).json({ error: `This ${field} is already taken` });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await withRetry(() => prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    }));

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last seen
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // Generate tokens
    const accessToken = signAccessToken({ userId: user.id, username: user.username });
    const refreshTokenRaw = crypto.randomUUID();
    const refreshTokenHashed = hashToken(refreshTokenRaw);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHashed,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
        deviceHint: req.headers['user-agent']?.substring(0, 64) || null,
      },
    });

    setRefreshCookie(res, refreshTokenRaw);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isGuest: user.isGuest,
        totalScore: user.totalScore.toString(),
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
      },
      accessToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /api/auth/guest ────────────────────────────────
router.post('/guest', async (req, res) => {
  try {
    const guestName = generateGuestName();
    const guestEmail = `guest_${crypto.randomUUID().slice(0, 8)}@sketchbattle.guest`;
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        username: guestName,
        email: guestEmail,
        passwordHash,
        isGuest: true,
      },
    });

    const accessToken = signAccessToken({ userId: user.id, username: user.username });
    const refreshTokenRaw = crypto.randomUUID();
    const refreshTokenHashed = hashToken(refreshTokenRaw);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHashed,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
        deviceHint: req.headers['user-agent']?.substring(0, 64) || null,
      },
    });

    setRefreshCookie(res, refreshTokenRaw);

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        isGuest: true,
      },
      accessToken,
    });
  } catch (err) {
    console.error('Guest creation error:', err);
    res.status(500).json({ error: 'Guest account creation failed' });
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshTokenRaw = req.cookies?.refreshToken;

    if (!refreshTokenRaw) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const tokenHash = hashToken(refreshTokenRaw);

    const storedToken = await withRetry(() => prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    }));

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      // If token was already revoked, this might be a replay attack — revoke ALL tokens
      if (storedToken?.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: storedToken.userId },
          data: { revokedAt: new Date() },
        });
      }
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (storedToken.user.isBanned) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair
    const accessToken = signAccessToken({
      userId: storedToken.user.id,
      username: storedToken.user.username,
    });
    const newRefreshRaw = crypto.randomUUID();
    const newRefreshHash = hashToken(newRefreshRaw);

    await prisma.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        tokenHash: newRefreshHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
        deviceHint: req.headers['user-agent']?.substring(0, 64) || null,
      },
    });

    setRefreshCookie(res, newRefreshRaw);

    res.json({
      user: {
        id: storedToken.user.id,
        username: storedToken.user.username,
        email: storedToken.user.email,
        isGuest: storedToken.user.isGuest,
        totalScore: storedToken.user.totalScore.toString(),
        gamesPlayed: storedToken.user.gamesPlayed,
        gamesWon: storedToken.user.gamesWon,
      },
      accessToken,
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ─── DELETE /api/auth/logout ─────────────────────────────
router.delete('/logout', requireAuth, async (req, res) => {
  try {
    const refreshTokenRaw = req.cookies?.refreshToken;

    if (refreshTokenRaw) {
      const tokenHash = hashToken(refreshTokenRaw);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    // Clear session in Redis
    await redis.del(`session:${req.user.userId}`);

    // Clear cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;
