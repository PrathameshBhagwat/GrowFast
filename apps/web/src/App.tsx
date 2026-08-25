import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { PhotoCaptureView } from './pages/PhotoCaptureView';
import { LoadingState } from '@growfast/ui';

export const App: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingState message="Loading..." fullPage />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:orderId/photos"
        element={
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'COUNTER', 'DELIVERY']}>
            <PhotoCaptureView />
          </ProtectedRoute>
        }
      />
      {/* Catch all — redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
