import { EVENTS, REDIS_KEYS, GAME } from '@sketchbattle/shared';
import { redis } from '../index.js';
import * as gameState from '../services/gameStateService.js';
import * as strokeService from '../services/strokeService.js';
import { isRateLimited } from '../middleware/rateLimit.js';

function getDualDrawerInfo(state, userId) {
  if (state.mode !== 'dual_battle') return null;
  if (userId === state.dualRedDrawerId) return { team: 'red', roundId: state.currentRoundIdRed };
  if (userId === state.dualBlueDrawerId) return { team: 'blue', roundId: state.currentRoundIdBlue };
  return null;
}

export function registerCanvasHandlers(io, socket) {

  socket.on(EVENTS.CANVAS_STROKE, async (data, callback) => {
    try {
      if (!socket.roomId) return;

      const state = await gameState.getRoomState(socket.roomId);
      if (!state || state.phase !== 'drawing') return;

      let roundId;
      let broadcastTarget;

      const dualInfo = getDualDrawerInfo(state, socket.userId);
      if (dualInfo) {
        roundId = dualInfo.roundId;
        broadcastTarget = `${socket.roomId}:${dualInfo.team}`;
      } else if (state.currentDrawerUserId === socket.userId) {
        roundId = state.currentRoundId;
        broadcastTarget = socket.roomId;
      } else {
        return;
      }

      if (!roundId) return;

      const limited = await isRateLimited(
        REDIS_KEYS.rateStroke(socket.userId),
        GAME.MAX_STROKES_PER_100MS,
        100
      );
      if (limited) return;

      const { opType, payload, clientSeq } = data;
      if (!opType || !payload) return;

      const serverSeq = await strokeService.addStroke(roundId, opType, payload);

      callback?.({ serverSeq, clientSeq });

      socket.to(broadcastTarget).emit(EVENTS.CANVAS_STROKE_BROADCAST, {
        opType,
        payload,
        serverSeq,
      });
    } catch (err) {
      console.error('Canvas stroke error:', err);
    }
  });

  socket.on(EVENTS.CANVAS_UNDO, async (data) => {
    try {
      if (!socket.roomId) return;

      const state = await gameState.getRoomState(socket.roomId);
      if (!state || state.phase !== 'drawing') return;

      let roundId;
      let broadcastTarget;

      const dualInfo = getDualDrawerInfo(state, socket.userId);
      if (dualInfo) {
        roundId = dualInfo.roundId;
        broadcastTarget = `${socket.roomId}:${dualInfo.team}`;
      } else if (state.currentDrawerUserId === socket.userId) {
        roundId = state.currentRoundId;
        broadcastTarget = socket.roomId;
      } else {
        return;
      }

      if (!roundId) return;

      const { targetSeq } = data;
      if (typeof targetSeq !== 'number') return;

      await strokeService.invalidateStroke(roundId, targetSeq);
      const invalidated = await strokeService.getInvalidatedSeqs(roundId);

      io.to(broadcastTarget).emit(EVENTS.CANVAS_UNDO_BROADCAST, {
        invalidatedSeqs: Array.from(invalidated),
      });
    } catch (err) {
      console.error('Canvas undo error:', err);
    }
  });

  socket.on(EVENTS.CANVAS_CLEAR, async () => {
    try {
      if (!socket.roomId) return;

      const state = await gameState.getRoomState(socket.roomId);
      if (!state || state.phase !== 'drawing') return;

      let roundId;
      let broadcastTarget;

      const dualInfo = getDualDrawerInfo(state, socket.userId);
      if (dualInfo) {
        roundId = dualInfo.roundId;
        broadcastTarget = `${socket.roomId}:${dualInfo.team}`;
      } else if (state.currentDrawerUserId === socket.userId) {
        roundId = state.currentRoundId;
        broadcastTarget = socket.roomId;
      } else {
        return;
      }

      if (!roundId) return;

      await strokeService.clearStrokes(roundId);
      const clearGeneration = await strokeService.incrementClearGeneration(roundId);
      await gameState.setRoomState(socket.roomId, { clearGeneration });

      io.to(broadcastTarget).emit(EVENTS.CANVAS_CLEARED, { clearGeneration });
    } catch (err) {
      console.error('Canvas clear error:', err);
    }
  });

  socket.on(EVENTS.CANVAS_SYNC_REQUEST, async (data, callback) => {
    try {
      if (!socket.roomId) return;

      const state = await gameState.getRoomState(socket.roomId);
      if (!state) return;

      let roundId;

      if (state.mode === 'dual_battle') {
        const playerRaw = await redis.hget(REDIS_KEYS.roomPlayers(socket.roomId), socket.userId);
        if (playerRaw) {
          const player = JSON.parse(playerRaw);
          roundId = player.team === 'red' ? state.currentRoundIdRed : state.currentRoundIdBlue;
        }
      }

      if (!roundId) roundId = state.currentRoundId;
      if (!roundId) return;

      const { lastKnownSeq = 0 } = data || {};
      const strokes = await strokeService.getStrokes(roundId, lastKnownSeq);
      const clearGen = await strokeService.getClearGeneration(roundId);

      callback?.({
        strokes,
        fromSeq: lastKnownSeq,
        toSeq: strokes.length > 0 ? strokes[strokes.length - 1].seq : lastKnownSeq,
        clearGeneration: clearGen,
      });
    } catch (err) {
      console.error('Canvas sync error:', err);
    }
  });
}
