// Use empty string so requests go through Vite's proxy in dev.
// In production, set VITE_API_URL to the actual server URL.
const API_URL = import.meta.env.VITE_API_URL || '';

let accessToken = null;
let refreshPromise = null;

// ─── Circuit Breaker ─────────────────────────────────────
// When the server is down, stop hammering it with requests.
let circuitOpen = false;
let circuitOpenedAt = 0;
const CIRCUIT_COOLDOWN_MS = 10000; // 10 seconds before retrying

function isCircuitOpen() {
  if (!circuitOpen) return false;
  // Auto-close after cooldown
  if (Date.now() - circuitOpenedAt > CIRCUIT_COOLDOWN_MS) {
    circuitOpen = false;
    return false;
  }
  return true;
}

function openCircuit() {
  circuitOpen = true;
  circuitOpenedAt = Date.now();
}

// ─── Token Management ────────────────────────────────────

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

// ─── Helpers ─────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isNetworkError(err) {
  if (!err) return false;
  // TypeError: Failed to fetch (Chrome), NetworkError (Firefox)
  if (err instanceof TypeError) {
    const msg = err.message || '';
    return (
      msg === 'Failed to fetch' ||
      msg.includes('NetworkError') ||
      msg.includes('ERR_CONNECTION_REFUSED') ||
      msg.includes('Load failed') // Safari
    );
  }
  // Our own wrapped errors
  if (err.message === 'Server unavailable') return true;
  return false;
}

// ─── Fetch with Retry (capped) ───────────────────────────

async function fetchWithRetry(url, options, retries = 1, delayMs = 800) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // 5xx? retry if attempts remain
      if (res.status >= 500 && attempt < retries) {
        await sleep(delayMs * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      // Network errors = server unreachable → don't retry, open circuit
      if (isNetworkError(err)) {
        openCircuit();
        throw new Error('Server unavailable');
      }
      // Other errors: retry if attempts remain
      if (attempt < retries) {
        await sleep(delayMs * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

// ─── Token Refresh ───────────────────────────────────────

async function refreshToken() {
  // Don't even try if server is known to be down
  if (isCircuitOpen()) {
    throw new Error('Server unavailable');
  }

  if (refreshPromise) return refreshPromise;

  refreshPromise = fetchWithRetry(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  }, 0) // no retries for refresh — fail fast
    .then(async (res) => {
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      accessToken = data.accessToken;
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// ─── Main API function ───────────────────────────────────

export async function api(endpoint, options = {}) {
  // Circuit breaker: don't flood a downed server
  if (isCircuitOpen()) {
    throw new Error('Server unavailable');
  }

  const url = `${API_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res;
  try {
    res = await fetchWithRetry(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    // Network error — already handled by fetchWithRetry (circuit opened)
    throw err;
  }

  // 401 with an existing token → try refresh once
  if (res.status === 401 && accessToken) {
    try {
      await refreshToken();
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetchWithRetry(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      clearAccessToken();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─── Auth API ──────────────────────────────────────────────

export async function apiRegister(username, email, password) {
  const data = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  accessToken = data.accessToken;
  return data;
}

export async function apiLogin(email, password) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  accessToken = data.accessToken;
  return data;
}

export async function apiGuestLogin() {
  const data = await api('/api/auth/guest', {
    method: 'POST',
  });
  accessToken = data.accessToken;
  return data;
}

export async function apiLogout() {
  await api('/api/auth/logout', { method: 'DELETE' }).catch(() => {});
  clearAccessToken();
}

export async function apiRefreshToken() {
  const data = await refreshToken();
  return data;
}

// ─── Room API ──────────────────────────────────────────────

export async function apiCreateRoom(settings) {
  return api('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export async function apiGetPublicRooms() {
  return api('/api/rooms/public');
}

export async function apiGetRoom(code) {
  return api(`/api/rooms/${code}`);
}

// ─── User API ──────────────────────────────────────────────

export async function apiGetMe() {
  return api('/api/users/me');
}

export async function apiGetLeaderboard() {
  return api('/api/users/leaderboard/top');
}
