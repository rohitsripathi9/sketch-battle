import { EVENTS, GAME } from '@sketchbattle/shared';
import prisma, { withRetry } from '../lib/prisma.js';
import * as gameState from '../services/gameStateService.js';
import * as roundService from '../services/roundService.js';
import { startDualBattle } from './dualBattle.js';

export function registerGameHandlers(io, socket) {

  socket.on(EVENTS.GAME_START, async (data, callback) => {
    try {
      if (!socket.roomId) {
        return callback?.({ error: 'Not in a room' });
      }

      const room = await withRetry(() => prisma.room.findUnique({
        where: { id: socket.roomId },
        include: {
          players: { where: { leftAt: null, role: 'player' } },
        },
      }));

      if (!room) return callback?.({ error: 'Room not found' });
      if (room.hostUserId !== socket.userId) {
        return callback?.({ error: 'Only the host can start the game' });
      }
      if (room.status !== 'waiting') {
        return callback?.({ error: 'Game already started' });
      }
      if (room.players.length < GAME.MIN_PLAYERS) {
        return callback?.({ error: `Need at least ${GAME.MIN_PLAYERS} players` });
      }

      if (room.mode === 'dual_battle' && room.players.length !== 4) {
        return callback?.({ error: '2v2 Battle requires exactly 4 players' });
      }

      if (room.mode === 'dual_battle') {
        await startDualBattle(io, socket.roomId, room);
      } else {
        await roundService.startGame(io, socket.roomId, room);
      }

      callback?.({ success: true });
    } catch (err) {
      console.error('Game start error:', err);
      callback?.({ error: 'Failed to start game' });
    }
  });

  socket.on(EVENTS.ROUND_WORD_SELECT, async (data, callback) => {
    try {
      if (!socket.roomId) return;

      const state = await gameState.getRoomState(socket.roomId);
      if (!state || state.phase !== 'selecting') return;
      if (state.currentDrawerUserId !== socket.userId) return;

      const { wordIndex } = data;
      if (typeof wordIndex !== 'number' || wordIndex < 0 || wordIndex > 2) return;

      await roundService.selectWord(io, socket.roomId, wordIndex);
      callback?.({ success: true });
    } catch (err) {
      console.error('Word select error:', err);
    }
  });
}
