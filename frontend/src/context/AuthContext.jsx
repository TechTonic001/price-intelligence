import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import apiClient from '../api/apiClient';

const AuthContext = createContext(null);

/**
 * AuthProvider — manages authentication state for the entire app.
 *
 * Security design:
 *   - Access token is stored in memory (a ref) — NOT localStorage or sessionStorage.
 *     This prevents XSS attacks from reading the token.
 *   - Refresh token lives in an HTTP-only cookie, managed by the browser and
 *     never accessible to JavaScript.
 *   - On mount, we attempt a silent refresh to restore the session from the cookie.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // In-memory access token — survives re-renders but not page refresh
  // (which is fine: a page refresh triggers the silent refresh on mount)
  const accessTokenRef = useRef(null);

  /** Exposes the current access token for the apiClient interceptor */
  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  /** Called by the apiClient interceptor when a token refresh succeeds */
  const setAccessToken = useCallback((token) => {
    accessTokenRef.current = token;
  }, []);

  /**
   * Attempts a silent token refresh using the HTTP-only refresh cookie.
   * Called on app mount to restore session after a page reload.
   * Returns the new access token on success, null on failure.
   */
  const silentRefresh = useCallback(async () => {
    try {
      const { data } = await apiClient.post('/auth/refresh');
      const newToken = data.data.accessToken;
      accessTokenRef.current = newToken;

      // Fetch user profile with the new token
      const meRes = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      setUser(meRes.data.data.user);
      return newToken;
    } catch {
      accessTokenRef.current = null;
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Registers a new account, then immediately logs the user in */
  const register = useCallback(async (email, password) => {
    await apiClient.post('/auth/register', { email, password });
    // Auto-login after successful registration
    const { data } = await apiClient.post('/auth/login', { email, password });
    const { accessToken, user: loggedInUser } = data.data;
    accessTokenRef.current = accessToken;
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  /** Logs in and stores the access token in memory */
  const login = useCallback(async (email, password) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    const { accessToken, user: loggedInUser } = data.data;
    accessTokenRef.current = accessToken;
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  /** Revokes the refresh token and clears local state */
  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      accessTokenRef.current = null;
      setUser(null);
    }
  }, []);

  // Attempt silent refresh on app mount to restore session
  React.useEffect(() => {
    silentRefresh();
  }, [silentRefresh]);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    getAccessToken,
    setAccessToken,
    silentRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
