import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button } from '@growfast/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { TagDesignerPage } from './TagDesignerPage';
import { StaffManagementPage } from './StaffManagementPage';
import { CatalogSettingsPage } from './CatalogSettingsPage';
import { Settings, Users, Tag, Shirt, ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';

export type OwnerSettingsTab = 'design-tags' | 'staff' | 'catalog';

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="owner-settings-back-btn"
              onClick={() => navigate('/')}
              aria-label="Back to POS"
              className="p-2 rounded-lg border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-blue-600 dark:text-blue-400" />
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
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

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* ─── Navigation Tabs: Staff, Design Tags, Catalog ───────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 sm:gap-2 overflow-x-auto border-t border-gray-100 dark:border-slate-850 pt-1">
          {/* Section: Staff */}
          <button
            type="button"
            id="owner-nav-staff-tab"
            onClick={() => setTab('staff')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors min-h-[44px] whitespace-nowrap cursor-pointer ${
              activeTab === 'staff'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            <Users size={16} />
            <span>Staff</span>
          </button>

          {/* Section: Design Tags */}
          <button
            type="button"
            id="owner-nav-design-tags-tab"
            onClick={() => setTab('design-tags')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors min-h-[44px] whitespace-nowrap cursor-pointer ${
              activeTab === 'design-tags'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            <Tag size={16} />
            <span>Design Tags</span>
          </button>

          {/* Section: Catalog */}
          <button
            type="button"
            id="owner-nav-catalog-tab"
            onClick={() => setTab('catalog')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors min-h-[44px] whitespace-nowrap cursor-pointer ${
              activeTab === 'catalog'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            <Shirt size={16} />
            <span>Catalog</span>
          </button>
        </div>
      </div>

      {/* ─── Active Tab Content ──────────────────────────────────────── */}
      <div className="py-2">
        {activeTab === 'design-tags' && <TagDesignerPage />}
        {activeTab === 'staff' && <StaffManagementPage />}
        {activeTab === 'catalog' && <CatalogSettingsPage />}
      </div>
    </div>
  );
};

export default OwnerSettingsPage;
