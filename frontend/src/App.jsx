import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { setupInterceptors } from './api/apiClient';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';

/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Shows a loading spinner while the silent refresh is in-flight on mount.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-gray-400 text-sm">Restoring session…</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const navigate = useNavigate();
  const { getAccessToken, setAccessToken } = useAuth();

  // Wire up the API client interceptors with auth context functions.
  // Done here (inside AuthProvider) to avoid circular imports.
  useEffect(() => {
    setupInterceptors({
      getAccessToken,
      setAccessToken,
      onAuthFailure: () => navigate('/login', { replace: true }),
    });
  }, [getAccessToken, setAccessToken, navigate]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
      </Route>

      {/* Catch-all — send unauthenticated users to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
