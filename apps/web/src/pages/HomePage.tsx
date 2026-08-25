import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card } from '@growfast/ui';
import { LogOut, Shirt, Shield, Users, Package, Truck } from 'lucide-react';

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; modules: string[] }> = {
  OWNER: {
    icon: <Shield size={24} />,
    color: '#7C3AED',
    modules: ['Dashboard', 'Orders', 'Customers', 'Employees', 'Analytics', 'Settings'],
  },
  MANAGER: {
    icon: <Users size={24} />,
    color: '#2563EB',
    modules: ['Dashboard', 'Orders', 'Customers', 'Processing', 'Reports'],
  },
  COUNTER: {
    icon: <Package size={24} />,
    color: '#059669',
    modules: ['New Order', 'Orders', 'Customers', 'Payments'],
  },
  DELIVERY: {
    icon: <Truck size={24} />,
    color: '#D97706',
    modules: ['Delivery Tasks', 'Route Map', 'Collections'],
  },
};

export const HomePage: React.FC = () => {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();

  if (!employee) return null;

  const config = ROLE_CONFIG[employee.role] || ROLE_CONFIG.COUNTER!;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
        fontFamily: "'Inter', sans-serif",
        background: '#F8FAFC',
      }}
    >
      <Card padding="lg" elevated style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}CC 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#FFFFFF',
            boxShadow: `0 4px 12px ${config.color}40`,
          }}
        >
          <Shirt size={32} />
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>
          Welcome to GrowFast Laundry
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#64748B', margin: '0 0 24px' }}>
          Laundry & Dry-Cleaning Management System
        </p>

        {/* Employee info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px',
            background: '#F8FAFC',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}CC 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            {config.icon}
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
              {employee.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
              {employee.role} · {employee.storeName}
            </div>
          </div>
        </div>

        {/* Module access */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#475569',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Your Modules
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {config.modules.map((mod) => (
              <span
                key={mod}
                style={{
                  padding: '6px 14px',
                  background: `${config.color}10`,
                  color: config.color,
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: `1px solid ${config.color}20`,
                }}
              >
                {mod}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}
        >
          <Button
            id="home-garment-catalog"
            variant="primary"
            size="md"
            onClick={() => navigate('/catalog')}
            icon={<Shirt size={16} />}
            fullWidth
          >
            Garment Catalog
          </Button>
        </div>

        <Button variant="ghost" size="md" onClick={logout} icon={<LogOut size={16} />} fullWidth>
          Sign Out
        </Button>
      </Card>
    </div>
  );
};
