import axios from 'axios';

/**
 * Axios instance pre-configured for the Price Intelligence API.
 *
 * Token Refresh Interceptor:
 *   When a response comes back with status 401 and code "TOKEN_EXPIRED",
 *   this interceptor automatically:
 *     1. Calls POST /auth/refresh to get a new access token (cookie is sent automatically)
 *     2. Updates the in-memory token via AuthContext
 *     3. Retries the original request with the new token
 *   This keeps the user logged in transparently without forcing manual re-login.
 *
 *   If the refresh itself fails (cookie expired / revoked), the user is
 *   redirected to the login page.
 *
 * Note: AuthContext is injected via `setupInterceptors()` rather than imported
 * directly to avoid circular dependency issues at module load time.
 */

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true, // Send HTTP-only refresh token cookie on every request
  headers: { 'Content-Type': 'application/json' },
});

let _getAccessToken = null;
let _setAccessToken = null;
let _onAuthFailure = null;
let _isRefreshing = false;
let _refreshSubscribers = [];

/**
 * Call this once in App.jsx after AuthContext is available.
 * Injects token accessors without creating a circular import.
 */
export function setupInterceptors({ getAccessToken, setAccessToken, onAuthFailure }) {
  _getAccessToken = getAccessToken;
  _setAccessToken = setAccessToken;
  _onAuthFailure = onAuthFailure;
}

function subscribeTokenRefresh(cb) {
  _refreshSubscribers.push(cb);
}

function onRefreshComplete(newToken) {
  _refreshSubscribers.forEach((cb) => cb(newToken));
  _refreshSubscribers = [];
}

// ── Request interceptor: attach access token ──────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = _getAccessToken?.();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle TOKEN_EXPIRED ────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const errorCode = error.response?.data?.error?.code;

    // Only attempt refresh for TOKEN_EXPIRED and only once per request
    if (
      error.response?.status === 401 &&
      errorCode === 'TOKEN_EXPIRED' &&
      !originalRequest._retried
    ) {
      originalRequest._retried = true;

      if (_isRefreshing) {
        // Another request already triggered a refresh — queue this one
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (newToken) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              resolve(apiClient(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      _isRefreshing = true;

      try {
        // Hit the refresh endpoint — the HTTP-only cookie is sent automatically
        const { data } = await apiClient.post('/auth/refresh');
        const newToken = data.data.accessToken;
        _setAccessToken?.(newToken);
        onRefreshComplete(newToken);

        // Retry the original request with the new token
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh token is also expired/revoked — redirect to login
        onRefreshComplete(null);
        _onAuthFailure?.();
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
