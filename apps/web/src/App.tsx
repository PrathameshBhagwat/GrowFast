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
import { DashboardPage } from './pages/DashboardPage';
import { TagDesignerPage } from './pages/TagDesignerPage';
import { OwnerSettingsPage } from './pages/OwnerSettingsPage';
import { DailyOrdersReportPage } from './pages/DailyOrdersReportPage';
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
      {/* Developer C — Dashboard (C7) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['OWNER']} redirectTo="/">
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      {/* Owner Settings Portal (Staff, Design Tags, Catalog) */}
      <Route
        path="/owner/settings"
        element={
          <ProtectedRoute allowedRoles={['OWNER']}>
            <OwnerSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/design-tags"
        element={<Navigate to="/owner/settings?tab=design-tags" replace />}
      />

      {/* Developer C — Admin Tag Designer (Phase T4 & Reference Defaults) */}
      <Route
        path="/admin/tag-designer"
        element={
          <ProtectedRoute allowedRoles={['OWNER']}>
            <TagDesignerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tag-designer"
        element={<Navigate to="/owner/settings?tab=design-tags" replace />}
      />
      {/* Developer B / Owner Settings — Daily Orders Report */}
      <Route
        path="/reports/daily-orders"
        element={
          <ProtectedRoute allowedRoles={['OWNER']}>
            <DailyOrdersReportPage />
          </ProtectedRoute>
        }
      />
      <Route path="/reports" element={<Navigate to="/reports/daily-orders" replace />} />

      {/* Catch all — redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
