// ─── Socket.io Event Names ───────────────────────────────

export const EVENTS = {
  // Connection
  ROOM_JOIN: 'room:join',
  ROOM_STATE_SNAPSHOT: 'room:state_snapshot',
  ROOM_RECONNECT: 'room:reconnect',

  // Game Flow
  GAME_START: 'game:start',
  GAME_STARTED: 'game:started',
  ROUND_SELECTING: 'round:selecting',
  ROUND_WORD_CHOICES: 'round:word_choices',
  ROUND_WORD_SELECT: 'round:word_select',
  ROUND_START: 'round:start',
  ROUND_HINT_REVEAL: 'round:hint_reveal',
  ROUND_END: 'round:end',
  GAME_END: 'game:end',

  // Canvas
  CANVAS_STROKE: 'canvas:stroke',
  CANVAS_STROKE_ACK: 'canvas:stroke_ack',
  CANVAS_STROKE_BROADCAST: 'canvas:stroke_broadcast',
  CANVAS_UNDO: 'canvas:undo',
  CANVAS_UNDO_BROADCAST: 'canvas:undo_broadcast',
  CANVAS_CLEAR: 'canvas:clear',
  CANVAS_CLEARED: 'canvas:cleared',
  CANVAS_SYNC_REQUEST: 'canvas:sync_request',
  CANVAS_SYNC_RESPONSE: 'canvas:sync_response',

  // Guess / Chat
  GUESS_SUBMIT: 'guess:submit',
  GUESS_RESULT: 'guess:result',
  CHAT_MESSAGE: 'chat:message',

  // Player
  PLAYER_JOINED: 'player:joined',
  PLAYER_DISCONNECTED: 'player:disconnected',
  PLAYER_RECONNECTED: 'player:reconnected',
  PLAYER_LEFT: 'player:left',
  PLAYERS_UPDATE: 'room:players_update',
  HOST_TRANSFERRED: 'host:transferred',

  // Dual Battle
  DUAL_WORD_GUESSED: 'dual:word_guessed',
  DUAL_ROUND_END: 'dual:round_end',
  DUAL_SESSION_END: 'dual:session_end',

  // Score
  SCORE_UPDATE: 'score:update',

  // Errors
  ERROR: 'error:game',
};

// ─── Redis Key Patterns ──────────────────────────────────

export const REDIS_KEYS = {
  room: (roomId) => `game:room:${roomId}`,
  roomPlayers: (roomId) => `game:room:${roomId}:players`,
  strokes: (roundId) => `game:strokes:${roundId}`,
  strokeSeq: (roundId) => `game:strokes:${roundId}:seq`,
  scores: (roomId) => `game:scores:${roomId}`,
  guessed: (roundId) => `game:guessed:${roundId}`,
  guessedTeam: (roundId, team) => `game:guessed:${roundId}:${team}`,
  timer: (roundId) => `game:timer:${roundId}`,
  wordChoices: (roomId) => `game:wordchoices:${roomId}`,
  word: (roundId) => `game:word:${roundId}`,
  wordTeam: (roundId, team) => `game:word:${roundId}:${team}`,
  canvasHint: (roundId) => `game:canvashint:${roundId}`,
  session: (userId) => `session:${userId}`,
  rateGuess: (userId) => `ratelimit:guess:${userId}`,
  rateStroke: (userId) => `ratelimit:stroke:${userId}`,
  rateChat: (userId) => `ratelimit:chat:${userId}`,
  disconnectGrace: (userId) => `disconnect:grace:${userId}`,
  dualWordCount: (roomId, team) => `dual:wordcount:${roomId}:${team}`,
  leaderboard: 'leaderboard:global',
};

// ─── Game Constants ──────────────────────────────────────

export const GAME = {
  // Room limits
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 12,
  MIN_ROUNDS: 1,
  MAX_ROUNDS: 10,
  MIN_DRAW_TIME: 30,
  MAX_DRAW_TIME: 180,
  DEFAULT_MAX_PLAYERS: 8,
  DEFAULT_ROUNDS: 3,
  DEFAULT_DRAW_TIME: 40,

  // Timers
  WORD_SELECT_TIME_MS: 10000,      // 10s to pick a word
  ROUND_END_DELAY_MS: 2000,        // 2s to show round results
  GRACE_PERIOD_MS: 30000,          // 30s reconnect window
  STROKE_FLUSH_INTERVAL_MS: 3000,  // flush to DB every 3s
  TIMER_CHECK_INTERVAL_MS: 500,    // check timers every 500ms
  ABANDONED_ROOM_TIMEOUT_MS: 300000, // 5 minutes

  // Scoring - Matchmaking (Scribble-style)
  DIFFICULTY_MULTIPLIER: { easy: 0.8, medium: 1.0, hard: 1.3 },

  // Scoring - Dual Battle
  DUAL_BASE_SCORE: 200,

  // Hint reveal thresholds (% of draw time elapsed)
  HINT_THRESHOLDS: [0.25, 0.50, 0.75],

  // Rate limits
  MAX_GUESSES_PER_SEC: 5,
  MAX_STROKES_PER_100MS: 50,
  MAX_CHAT_PER_SEC: 10,
  MAX_JOIN_ATTEMPTS_PER_MIN: 10,

  // Strokes
  MAX_STROKES_REDIS: 1000,

  // Room code
  CODE_LENGTH: 6,
  CODE_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
};
