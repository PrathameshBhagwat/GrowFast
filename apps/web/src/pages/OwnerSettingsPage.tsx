import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button } from '@growfast/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { TagDesignerPage } from './TagDesignerPage';
import { StaffManagementPage } from './StaffManagementPage';
import { CatalogSettingsPage } from './CatalogSettingsPage';
import { DailyOrdersReportPage } from './DailyOrdersReportPage';
import { Settings, Users, Tag, Shirt, BarChart3, ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';

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
      <div className="no-print border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 shadow-xs">
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Back button + Title & Role + Subtitle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="owner-settings-back-btn"
              onClick={() => navigate('/')}
              aria-label="Back to POS"
              className="w-8 h-8 rounded-[3px] border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '3px',
                border: '1px solid var(--border, #e2e8f0)',
                background: 'var(--bg-surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #475569)',
                cursor: 'pointer',
                flexShrink: 0,
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
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
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
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto flex-nowrap scrollbar-none">
            {/* Section: Staff */}
            <button
              type="button"
              id="owner-nav-staff-tab"
              onClick={() => setTab('staff')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-[4px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'staff'
                  ? 'border border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Users size={15} />
              <span>Staff</span>
            </button>

            {/* Section: Design Tags */}
            <button
              type="button"
              id="owner-nav-design-tags-tab"
              onClick={() => setTab('design-tags')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-[4px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'design-tags'
                  ? 'border border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Tag size={15} />
              <span>Design Tags</span>
            </button>

            {/* Section: Catalog */}
            <button
              type="button"
              id="owner-nav-catalog-tab"
              onClick={() => setTab('catalog')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-[4px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'catalog'
                  ? 'border border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Shirt size={15} />
              <span>Catalog</span>
            </button>

            {/* Section: Reports */}
            <button
              type="button"
              id="owner-nav-reports-tab"
              onClick={() => setTab('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-[4px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'reports'
                  ? 'border border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 size={15} />
              <span>Reports</span>
            </button>
          </div>

          {/* Right: Theme Toggle */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
