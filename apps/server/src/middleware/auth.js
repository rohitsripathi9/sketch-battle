import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load RS256 keys
const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY
  ? process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n')
  : fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'keys', 'private.pem'), 'utf8');

const PUBLIC_KEY = process.env.JWT_PUBLIC_KEY
  ? process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n')
  : fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'keys', 'public.pem'), 'utf8');

/**
 * Sign a JWT access token (15 min)
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    issuer: 'sketchbattle',
  });
}

/**
 * Sign a JWT refresh token (7 days)
 */
export function signRefreshToken(payload) {
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: 'sketchbattle',
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, PUBLIC_KEY, {
      algorithms: ['RS256'],
      issuer: 'sketchbattle',
    });
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware — requires valid JWT in Authorization header
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

/**
 * Socket.io middleware — requires valid JWT in handshake auth
 */
export function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('Invalid or expired token'));
  }

  socket.userId = decoded.userId;
  socket.username = decoded.username;
  next();
}

export { PUBLIC_KEY };
