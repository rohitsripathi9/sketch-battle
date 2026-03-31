import { useEffect, useCallback, useSyncExternalStore, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '../lib/api';

// Use empty string so WebSocket connects through Vite's proxy in dev.
// In production, set VITE_WS_URL to the actual server URL.
const WS_URL = import.meta.env.VITE_WS_URL || '';

let socket = null;
let listeners = new Set();
let connectionFailed = false; // Track if we've exhausted reconnection attempts

function notify() {
  listeners.forEach(fn => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return socket?.connected ?? false;
}

export function getSocket() {
  return socket;
}

export function createSocket() {
  const token = getAccessToken();
  if (!token) return null;

  // If a socket already exists and is connected or actively connecting, reuse it
  if (socket) {
    if (socket.connected) return socket;
    // If it's mid-connection attempt, don't create a new one
    if (socket.active) return socket;
    // Otherwise destroy the old one first
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  connectionFailed = false;

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,      // Reduced from 10 — don't hammer
    reconnectionDelay: 2000,      // Start at 2s
    reconnectionDelayMax: 10000,  // Cap at 10s
    timeout: 10000,               // Connection timeout
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id);
    connectionFailed = false;
    notify();
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
    notify();
  });

  socket.on('connect_error', (err) => {
    // Log once, don't flood
    if (!connectionFailed) {
      console.warn('[socket] connect_error:', err.message);
    }
    notify();
  });

  // When all reconnection attempts are exhausted, retry with backoff
  socket.io.on('reconnect_failed', () => {
    console.warn('[socket] Reconnection attempts exhausted. Will retry in 5s...');
    connectionFailed = true;
    notify();
    setTimeout(() => {
      if (socket && !socket.connected) {
        console.log('[socket] Retrying connection...');
        connectionFailed = false;
        socket.connect();
      }
    }, 5000);
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log(`[socket] reconnect attempt #${attempt}`);
  });

  socket.io.on('reconnect', () => {
    console.log('[socket] reconnected successfully');
    connectionFailed = false;
    notify();
  });

  return socket;
}

export function destroySocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.disconnect();
    socket = null;
    connectionFailed = false;
    notify();
  }
}

export function useSocket() {
  const isConnected = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!socket && getAccessToken()) createSocket();
  }, []);

  const emit = useCallback((event, data, callback) => {
    if (!socket || !socket.connected) {
      console.warn('[socket] emit SKIP (not connected):', event);
      // If there's a callback, call it with an error so callers don't hang
      if (typeof callback === 'function') {
        callback({ error: 'Not connected to server' });
      }
      return;
    }
    socket.emit(event, data, callback);
  }, []);

  const on = useCallback((event, handler) => {
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => {
      // Guard: socket may have been destroyed by the time cleanup runs
      if (socket) {
        socket.off(event, handler);
      }
    };
  }, []);

  const off = useCallback((event, handler) => {
    if (socket) {
      socket.off(event, handler);
    }
  }, []);

  return { isConnected, emit, on, off, socket };
}
