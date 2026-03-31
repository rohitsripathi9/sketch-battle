import { socketAuth } from '../middleware/auth.js';
import { redis } from '../index.js';
import prisma, { withRetry } from '../lib/prisma.js';
import { EVENTS, REDIS_KEYS, GAME } from '@sketchbattle/shared';
import { registerCanvasHandlers } from './canvas.js';
import { registerGameHandlers } from './game.js';
import { registerGuessHandlers } from './guess.js';
import * as gameState from '../services/gameStateService.js';
import * as roundService from '../services/roundService.js';

export function setupSocketHandlers(io) {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`Connected: ${socket.username} (${socket.userId})`);

    // ═══════════════════════════════════════════════════════
    // REGISTER ALL HANDLERS SYNCHRONOUSLY FIRST
    // (async cloud I/O happens AFTER, so events aren't lost)
    // ═══════════════════════════════════════════════════════

    // ─── Room Join ──────────────────────────────────────
    socket.on(EVENTS.ROOM_JOIN, async (data, callback) => {
      try {
        const { roomCode, role = 'player' } = data;
        console.log(`[room:join] ${socket.username} joining ${roomCode}`);

        const room = await withRetry(() => prisma.room.findUnique({
          where: { code: roomCode.toUpperCase() },
          include: {
            players: { where: { leftAt: null }, include: { user: { select: { username: true } } } },
          },
        }));

        if (!room) return callback?.({ error: 'Room not found' });

        if (room.status === 'finished' || room.status === 'abandoned') {
          return callback?.({ error: 'Room is no longer active' });
        }

        const activePlayers = room.players.filter(p => p.role === 'player');
        const assignRole = room.status === 'in_progress' && role === 'player'
          ? 'spectator' : role;

        if (assignRole === 'player' && activePlayers.length >= room.maxPlayers) {
          return callback?.({ error: 'Room is full' });
        }

        let roomPlayer = room.players.find(p => p.userId === socket.userId);

        if (roomPlayer) {
          await prisma.roomPlayer.update({
            where: { id: roomPlayer.id },
            data: { isConnected: true, leftAt: null },
          });
        } else {
          const seatOrder = room.players.length;
          let team = 'none';
          if (room.mode === 'dual_battle') {
            const redCount = room.players.filter(p => p.team === 'red').length;
            const blueCount = room.players.filter(p => p.team === 'blue').length;
            team = redCount <= blueCount ? 'red' : 'blue';
          }

          try {
            roomPlayer = await prisma.roomPlayer.create({
              data: {
                roomId: room.id,
                userId: socket.userId,
                role: assignRole,
                team,
                seatOrder,
              },
            });
          } catch (e) {
            if (e.code === 'P2002') {
              roomPlayer = await prisma.roomPlayer.findFirst({
                where: { roomId: room.id, userId: socket.userId },
              });
              if (roomPlayer) {
                await prisma.roomPlayer.update({
                  where: { id: roomPlayer.id },
                  data: { isConnected: true, leftAt: null },
                });
              }
            } else {
              throw e;
            }
          }
        }

        socket.join(room.id);
        socket.roomId = room.id;
        socket.roomCode = room.code;

        await redis.hset(REDIS_KEYS.roomPlayers(room.id), socket.userId, JSON.stringify({
          role: roomPlayer.role,
          team: roomPlayer.team,
          score: roomPlayer.totalScore || 0,
          isConnected: true,
          seatOrder: roomPlayer.seatOrder,
          username: socket.username,
        }));

        await redis.hset(REDIS_KEYS.session(socket.userId), 'roomId', room.id);
        await redis.del(REDIS_KEYS.disconnectGrace(socket.userId));

        const roomStateData = await gameState.getRoomState(room.id);
        const playersRaw = await redis.hgetall(REDIS_KEYS.roomPlayers(room.id));
        const players = Object.entries(playersRaw).map(([uid, json]) => ({
          userId: uid,
          ...JSON.parse(json),
        }));

        console.log(`[room:join] ${socket.username} → snapshot sent with ${players.length} player(s)`);

        socket.emit(EVENTS.ROOM_STATE_SNAPSHOT, {
          roomId: room.id,
          roomCode: room.code,
          mode: room.mode,
          status: roomStateData?.status || room.status,
          hostUserId: room.hostUserId,
          maxPlayers: room.maxPlayers,
          roundCount: room.roundCount,
          drawTimeSecs: room.drawTimeSecs,
          players,
          currentRound: roomStateData?.currentRound || 0,
          timerEndMs: roomStateData?.timerEndMs || null,
          wordHint: roomStateData?.wordHint || null,
          phase: roomStateData?.phase || null,
          currentDrawerUserId: roomStateData?.currentDrawerUserId || null,
          currentRoundId: roomStateData?.currentRoundId || null,
          currentRoundIdRed: roomStateData?.currentRoundIdRed || null,
          currentRoundIdBlue: roomStateData?.currentRoundIdBlue || null,
          dualRedDrawerId: roomStateData?.dualRedDrawerId || null,
          dualBlueDrawerId: roomStateData?.dualBlueDrawerId || null,
          clearGeneration: roomStateData?.clearGeneration || 0,
        });

        // Join team socket room for dual_battle
        if (room.mode === 'dual_battle' && roomPlayer.team && roomPlayer.team !== 'none') {
          socket.join(`${room.id}:${roomPlayer.team}`);
        }

        socket.to(room.id).emit(EVENTS.PLAYER_JOINED, {
          userId: socket.userId,
          username: socket.username,
          role: roomPlayer.role,
          team: roomPlayer.team,
        });

        io.to(room.id).emit(EVENTS.PLAYERS_UPDATE, { players });

        callback?.({ success: true, roomId: room.id });
      } catch (err) {
        console.error('Room join error:', err);
        callback?.({ error: 'Failed to join room' });
      }
    });

    // ─── Disconnect ─────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`Disconnected: ${socket.username} (${socket.userId})`);

      if (socket.roomId) {
        await redis.set(
          REDIS_KEYS.disconnectGrace(socket.userId),
          socket.roomId,
          'PX', 30000
        );

        const playerJson = await redis.hget(REDIS_KEYS.roomPlayers(socket.roomId), socket.userId);
        if (playerJson) {
          const player = JSON.parse(playerJson);
          player.isConnected = false;
          await redis.hset(REDIS_KEYS.roomPlayers(socket.roomId), socket.userId, JSON.stringify(player));
        }

        await prisma.roomPlayer.updateMany({
          where: { roomId: socket.roomId, userId: socket.userId },
          data: { isConnected: false },
        }).catch(() => {});

        socket.to(socket.roomId).emit(EVENTS.PLAYER_DISCONNECTED, {
          userId: socket.userId,
          graceMs: 30000,
        });

        const playersRawDc = await redis.hgetall(REDIS_KEYS.roomPlayers(socket.roomId));
        const playersDc = Object.entries(playersRawDc).map(([uid, json]) => ({
          userId: uid,
          ...JSON.parse(json),
        }));
        socket.to(socket.roomId).emit(EVENTS.PLAYERS_UPDATE, { players: playersDc });

        const state = await gameState.getRoomState(socket.roomId);
        if (state?.phase === 'drawing' && state.currentDrawerUserId === socket.userId) {
          const capturedRoomId = socket.roomId;
          const capturedUserId = socket.userId;
          const capturedRoundId = state.currentRoundId;
          setTimeout(async () => {
            const grace = await redis.get(REDIS_KEYS.disconnectGrace(capturedUserId));
            if (grace && capturedRoundId) {
              await roundService.endRound(io, capturedRoomId, capturedRoundId);
            }
          }, 30000);
        }
      }

      await prisma.user.updateMany({
        where: { id: socket.userId },
        data: { lastSeenAt: new Date() },
      }).catch(() => {});
    });

    // ─── Reconnect ──────────────────────────────────────
    socket.on(EVENTS.ROOM_RECONNECT, async (data, callback) => {
      try {
        const { roomCode } = data;
        const room = await withRetry(() => prisma.room.findUnique({
          where: { code: roomCode.toUpperCase() },
        }));
        if (!room) return callback?.({ error: 'Room not found' });

        const roomPlayer = await withRetry(() => prisma.roomPlayer.findFirst({
          where: { roomId: room.id, userId: socket.userId },
        }));
        if (!roomPlayer) return callback?.({ error: 'You are not in this room' });

        await prisma.roomPlayer.update({
          where: { id: roomPlayer.id },
          data: { isConnected: true, leftAt: null },
        });

        await redis.del(REDIS_KEYS.disconnectGrace(socket.userId));

        socket.join(room.id);
        socket.roomId = room.id;
        socket.roomCode = room.code;

        const playerJson = await redis.hget(REDIS_KEYS.roomPlayers(room.id), socket.userId);
        if (playerJson) {
          const player = JSON.parse(playerJson);
          player.isConnected = true;
          await redis.hset(REDIS_KEYS.roomPlayers(room.id), socket.userId, JSON.stringify(player));
        }

        await redis.hset(REDIS_KEYS.session(socket.userId), 'roomId', room.id);

        const roomStateData = await gameState.getRoomState(room.id);
        const playersRaw = await redis.hgetall(REDIS_KEYS.roomPlayers(room.id));
        const players = Object.entries(playersRaw).map(([uid, json]) => ({
          userId: uid,
          ...JSON.parse(json),
        }));

        socket.emit(EVENTS.ROOM_STATE_SNAPSHOT, {
          roomId: room.id,
          roomCode: room.code,
          mode: room.mode,
          status: roomStateData?.status || room.status,
          hostUserId: room.hostUserId,
          maxPlayers: room.maxPlayers,
          roundCount: room.roundCount,
          drawTimeSecs: room.drawTimeSecs,
          players,
          currentRound: roomStateData?.currentRound || 0,
          timerEndMs: roomStateData?.timerEndMs || null,
          wordHint: roomStateData?.wordHint || null,
          phase: roomStateData?.phase || null,
          currentDrawerUserId: roomStateData?.currentDrawerUserId || null,
          currentRoundId: roomStateData?.currentRoundId || null,
          currentRoundIdRed: roomStateData?.currentRoundIdRed || null,
          currentRoundIdBlue: roomStateData?.currentRoundIdBlue || null,
          dualRedDrawerId: roomStateData?.dualRedDrawerId || null,
          dualBlueDrawerId: roomStateData?.dualBlueDrawerId || null,
          clearGeneration: roomStateData?.clearGeneration || 0,
        });

        // Rejoin team socket room for dual_battle
        if (room.mode === 'dual_battle' && roomPlayer.team && roomPlayer.team !== 'none') {
          socket.join(`${room.id}:${roomPlayer.team}`);
        }

        socket.to(room.id).emit(EVENTS.PLAYER_RECONNECTED, { userId: socket.userId });

        io.to(room.id).emit(EVENTS.PLAYERS_UPDATE, { players });

        callback?.({ success: true });
      } catch (err) {
        console.error('Reconnect error:', err);
        callback?.({ error: 'Failed to reconnect' });
      }
    });

    // Register Phase 3 + 4 + 5 handlers
    registerCanvasHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerGuessHandlers(io, socket);

    // ─── Async initialization (non-blocking) ────────────
    (async () => {
      try {
        await redis.hset(REDIS_KEYS.session(socket.userId), {
          socketId: socket.id,
          connectedAt: Date.now().toString(),
        });
        await prisma.user.updateMany({
          where: { id: socket.userId },
          data: { lastSeenAt: new Date() },
        });
      } catch (err) {
        console.error('Connection init error:', err.message);
      }
    })();
  });

  // ─── Timer Check (runs every 500ms) ──────────────────
  setInterval(async () => {
    try {
      const roomKeys = await redis.keys('game:room:*');
      for (const key of roomKeys) {
        if (key.includes(':players')) continue;
        const roomId = key.replace('game:room:', '');
        const state = await redis.hgetall(key);
        if (state.phase !== 'drawing' || !state.currentRoundId) continue;

        const timerEnd = await redis.get(REDIS_KEYS.timer(state.currentRoundId));
        if (timerEnd && Date.now() >= parseInt(timerEnd)) {
          await roundService.endRound(io, roomId, state.currentRoundId);
        }
      }
    } catch (err) {
      // non-critical
    }
  }, GAME.TIMER_CHECK_INTERVAL_MS);

  // ─── Stroke Flush (runs every 3s) ────────────────────
  setInterval(async () => {
    try {
      const roomKeys = await redis.keys('game:room:*');
      for (const key of roomKeys) {
        if (key.includes(':players')) continue;
        const state = await redis.hgetall(key);
        if (state.phase !== 'drawing') continue;
        const { flushStrokesToDb } = await import('../services/strokeService.js');
        if (state.currentRoundId) await flushStrokesToDb(state.currentRoundId);
        if (state.currentRoundIdRed) await flushStrokesToDb(state.currentRoundIdRed);
        if (state.currentRoundIdBlue) await flushStrokesToDb(state.currentRoundIdBlue);
      }
    } catch (err) {
      // non-critical
    }
  }, GAME.STROKE_FLUSH_INTERVAL_MS);
}
