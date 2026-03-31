import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  apiLogin,
  apiRegister,
  apiGuestLogin,
  apiLogout,
  apiRefreshToken,
  setAccessToken,
  clearAccessToken,
} from '../lib/api';
import { createSocket, destroySocket } from '../hooks/useSocket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session from refresh token on mount
  useEffect(() => {
    let cancelled = false;

    async function tryRefresh() {
      try {
        const data = await apiRefreshToken();
        if (!cancelled) {
          setUser(data.user);
          createSocket();
        }
      } catch (err) {
        // Silently handle — user is simply not logged in
        if (!cancelled) {
          clearAccessToken();
        }
        // Don't log network errors (expected when server is down)
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    tryRefresh();

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    setUser(data.user);
    createSocket();
    return data;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const data = await apiRegister(username, email, password);
    setUser(data.user);
    createSocket();
    return data;
  }, []);

  const loginAsGuest = useCallback(async () => {
    const data = await apiGuestLogin();
    setUser(data.user);
    createSocket();
    return data;
  }, []);

  const logout = useCallback(async () => {
    destroySocket();
    await apiLogout();
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    loginAsGuest,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
