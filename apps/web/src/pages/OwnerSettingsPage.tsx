import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button } from '@growfast/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { TagDesignerPage } from './TagDesignerPage';
import { StaffManagementPage } from './StaffManagementPage';
import { CatalogSettingsPage } from './CatalogSettingsPage';
import { DailyOrdersReportPage } from './DailyOrdersReportPage';
import {
  Settings,
  Users,
  Tag,
  Shirt,
  BarChart3,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

export type OwnerSettingsTab = 'design-tags' | 'staff' | 'catalog' | 'reports';

export const OwnerSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as OwnerSettingsTab) || 'design-tags';

  const isOwner = employee?.role === 'OWNER';

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
            Owner Authorization Required
          </h1>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
            Only authenticated Store Owners have authorization to access Owner Settings.
          </p>
          <Button variant="primary" onClick={() => navigate('/')} className="w-full">
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const setTab = (tab: OwnerSettingsTab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100">
      {/* ─── Top Owner Settings Header ────────────────────────────────── */}
      <div
        className="no-print sticky top-0 z-30"
        style={{
          background: 'var(--bg-surface, #ffffff)',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          boxShadow: 'var(--shadow-neu-card-sm)',
        }}
      >
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Back button + Title & Role + Subtitle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="owner-settings-back-btn"
              onClick={() => navigate('/')}
              aria-label="Back to POS"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--border, #e2e8f0)',
                background: 'var(--bg-surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #475569)',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: 'var(--shadow-neu-card-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-blue-600 dark:text-blue-400" />
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-slate-100">
                  Owner Settings
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: 'rgba(37, 99, 235, 0.12)',
                    color: 'var(--accent, #2563EB)',
                    border: '1px solid rgba(37, 99, 235, 0.25)',
                  }}
                >
                  <ShieldCheck size={12} />
                  Owner Role
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Store-wide configuration, access control, and tag designer
              </p>
            </div>
          </div>

          {/* Navigation Tabs: Staff, Design Tags, Catalog, Reports */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto flex-nowrap scrollbar-none">
            {/* Section: Staff */}
            <button
              type="button"
              id="owner-nav-staff-tab"
              onClick={() => setTab('staff')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'staff' ? 700 : 500,
                borderRadius: '9999px',
                border: activeTab === 'staff' ? 'none' : '1px solid transparent',
                background:
                  activeTab === 'staff'
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : 'transparent',
                color: activeTab === 'staff' ? '#FFFFFF' : 'var(--text-secondary, #475569)',
                boxShadow: activeTab === 'staff' ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={15} />
              <span>Staff</span>
            </button>

            {/* Section: Design Tags */}
            <button
              type="button"
              id="owner-nav-design-tags-tab"
              onClick={() => setTab('design-tags')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'design-tags' ? 700 : 500,
                borderRadius: '9999px',
                border: activeTab === 'design-tags' ? 'none' : '1px solid transparent',
                background:
                  activeTab === 'design-tags'
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : 'transparent',
                color: activeTab === 'design-tags' ? '#FFFFFF' : 'var(--text-secondary, #475569)',
                boxShadow:
                  activeTab === 'design-tags' ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Tag size={15} />
              <span>Design Tags</span>
            </button>

            {/* Section: Catalog */}
            <button
              type="button"
              id="owner-nav-catalog-tab"
              onClick={() => setTab('catalog')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'catalog' ? 700 : 500,
                borderRadius: '9999px',
                border: activeTab === 'catalog' ? 'none' : '1px solid transparent',
                background:
                  activeTab === 'catalog'
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : 'transparent',
                color: activeTab === 'catalog' ? '#FFFFFF' : 'var(--text-secondary, #475569)',
                boxShadow: activeTab === 'catalog' ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Shirt size={15} />
              <span>Catalog</span>
            </button>

            {/* Section: Reports */}
            <button
              type="button"
              id="owner-nav-reports-tab"
              onClick={() => setTab('reports')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'reports' ? 700 : 500,
                borderRadius: '9999px',
                border: activeTab === 'reports' ? 'none' : '1px solid transparent',
                background:
                  activeTab === 'reports'
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : 'transparent',
                color: activeTab === 'reports' ? '#FFFFFF' : 'var(--text-secondary, #475569)',
                boxShadow: activeTab === 'reports' ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <BarChart3 size={15} />
              <span>Reports</span>
            </button>
          </div>

          {/* Right: Theme Toggle */}
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
          </div>
        </div>
      </div>

      {/* ─── Active Tab Content ──────────────────────────────────────── */}
      <div className="pt-2">
        {activeTab === 'design-tags' && <TagDesignerPage />}
        {activeTab === 'staff' && <StaffManagementPage />}
        {activeTab === 'catalog' && <CatalogSettingsPage />}
        {activeTab === 'reports' && <DailyOrdersReportPage />}
      </div>
    </div>
  );
};

export default OwnerSettingsPage;
