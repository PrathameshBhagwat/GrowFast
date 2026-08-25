import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { PhotoCaptureView } from './pages/PhotoCaptureView';
import { CatalogSettingsPage } from './pages/CatalogSettingsPage';
import { MasterDataPage } from './pages/MasterDataPage';
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
      {/* Developer A — Customer Profile (A3) */}
      <Route
        path="/customers/:customerId"
        element={
          <ProtectedRoute>
            <CustomerProfilePage />
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
      {/* Developer B — Catalog Management (B1) */}
      <Route
        path="/catalog"
        element={
          <ProtectedRoute>
            <CatalogSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/master-data"
        element={
          <ProtectedRoute>
            <MasterDataPage />
          </ProtectedRoute>
        }
      />
      {/* Catch all — redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
