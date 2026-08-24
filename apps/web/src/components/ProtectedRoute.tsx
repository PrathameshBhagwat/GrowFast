import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '@growfast/ui';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

/**
 * ProtectedRoute — wraps pages that require authentication.
 * Redirects to /login if not authenticated.
 * Optionally restricts access by role.
 *
 * NOTE: This is a UX convenience only. Server-side authorization
 * is the real security boundary.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, employee } = useAuth();

  if (isLoading) {
    return <LoadingState message="Checking authentication..." fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && employee && !allowedRoles.includes(employee.role)) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: "'Inter', sans-serif",
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#FEF2F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
          }}
        >
          🔒
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>Access Denied</h2>
        <p style={{ fontSize: '0.9rem', color: '#64748B', maxWidth: '400px' }}>
          Your role ({employee.role}) does not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
