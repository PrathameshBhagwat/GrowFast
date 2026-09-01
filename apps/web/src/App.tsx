import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { PhotoCaptureView } from './pages/PhotoCaptureView';
import { CatalogSettingsPage } from './pages/CatalogSettingsPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { OrderWizardPage } from './pages/OrderWizardPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { DeliveryPage } from './pages/DeliveryPage';
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
      {/* Developer A — Staff Management (A6) */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
            <StaffManagementPage />
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
      {/* Developer B — Order Management (B3) */}
      <Route
        path="/orders/new"
        element={
          <ProtectedRoute>
            <OrderWizardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:orderId"
        element={
          <ProtectedRoute>
            <OrderDetailPage />
          </ProtectedRoute>
        }
      />
      {/* Developer C — Delivery Management (C5) */}
      <Route
        path="/deliveries"
        element={
          <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'COUNTER', 'DELIVERY']}>
            <DeliveryPage />
          </ProtectedRoute>
        }
      />
      {/* Catch all — redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
