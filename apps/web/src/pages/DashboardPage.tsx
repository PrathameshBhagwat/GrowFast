import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, LoadingState, ErrorState, EmptyState, StatusChip } from '@growfast/ui';
import {
  OrderStatus,
  type DashboardSummaryDTO,
  type MetricComparison,
} from '@growfast/shared-types';
import { fetchDashboardSummary } from '../services/dashboard.api';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { GrowFastLogo } from '../components/GrowFastLogo';
import { DashboardTrendChart } from '../components/DashboardTrendChart';
import { DashboardBreakdownChart } from '../components/DashboardBreakdownChart';
import { DashboardActionCenter, type ActionQueueType } from '../components/DashboardActionCenter';
import {
  type DashboardDatePreset,
  type DateRange,
  getDateRangeForPreset,
  validateCustomRange,
  formatKolkataDate,
  formatPeriodLabel,
} from '../utils/dashboard-date';
import {
  LayoutDashboard,
  PlusCircle,
  Package,
  Users,
  Truck,
  Shirt,
  BarChart3,
  Settings,
  Store,
  ChevronDown,
  RotateCw,
  Wallet,
  Receipt,
  Coins,
  Calendar,
  Clock,
  ShoppingBag,
  ArrowLeft,
} from 'lucide-react';

const POLL_INTERVAL_MS = 30_000;

const PRESETS: { key: DashboardDatePreset; label: string }[] = [
  { key: 'TODAY', label: 'Today' },
  { key: 'YESTERDAY', label: 'Yesterday' },
  { key: 'THIS_WEEK', label: 'This Week' },
  { key: 'THIS_MONTH', label: 'This Month' },
  { key: 'CUSTOM', label: 'Custom Range' },
];

/* ─── Helpers ─────────────────────────────────────────────────── */

function formatCurrency(v?: number | null): string {
  const val = v ?? 0;
  return (
    '\u20b9' +
    val.toLocaleString('en-IN', {
      minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: '#075985',
  SORTING: '#7C3AED',
  PROCESSING: '#92400E',
  DRYING: '#0E7490',
  IRONING: '#A16207',
  QUALITY_CHECK: '#4338CA',
  PACKED: '#1D4ED8',
  READY: '#065F46',
  OUT_FOR_DELIVERY: '#1E40AF',
  DELIVERED: '#166534',
  CANCELLED: '#991B1B',
};

const ACTIVITY_ICONS: Record<string, string> = {
  ORDER_CREATED: '\ud83d\udce6',
  ORDER_READY: '\u2705',
  PAYMENT_RECEIVED: '\ud83d\udcb0',
  ORDER_OUT_FOR_DELIVERY: '\ud83d\ude9a',
  ORDER_DELIVERED: '\ud83c\udfe0',
};

type StatusFilter = 'ALL' | string;

/* ─── Main Component ──────────────────────────────────────────── */

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const [data, setData] = useState<DashboardSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [actionCenterQueue, setActionCenterQueue] = useState<ActionQueueType>('OVERDUE');

  // Date Filter & Period Selection (Phase 2)
  const [preset, setPreset] = useState<DashboardDatePreset>('TODAY');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeForPreset('TODAY'));
  const [customStartDate, setCustomStartDate] = useState<string>(() => dateRange.startDate);
  const [customEndDate, setCustomEndDate] = useState<string>(() => dateRange.endDate);
  const [customError, setCustomError] = useState<string | null>(null);
  const [showCustomInputs, setShowCustomInputs] = useState<boolean>(false);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const todayKolkataStr = formatKolkataDate();

  useEffect(() => {
    if (employee && employee.role !== 'OWNER') {
      navigate('/', { replace: true });
    }
  }, [employee, navigate]);

  /* ─── Data Fetching ─────────────────────────────────────────── */

  const loadDashboard = useCallback(async (range: DateRange, silent = false) => {
    // Cancel previous in-flight request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = ++requestIdRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await fetchDashboardSummary(range.startDate, range.endDate, controller.signal);
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setData(result);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setError(err?.message || 'Failed to load dashboard data. Please try again.');
      }
    } finally {
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /* ─── Handlers ──────────────────────────────────────────────── */

  const handleSelectPreset = (newPreset: DashboardDatePreset) => {
    if (newPreset === preset && newPreset !== 'CUSTOM') {
      return;
    }
    setPreset(newPreset);
    setCustomError(null);
    if (newPreset === 'CUSTOM') {
      setShowCustomInputs(true);
      return;
    }
    setShowCustomInputs(false);
    const newRange = getDateRangeForPreset(newPreset);
    if (newRange.startDate !== dateRange.startDate || newRange.endDate !== dateRange.endDate) {
      setDateRange(newRange);
      setCustomStartDate(newRange.startDate);
      setCustomEndDate(newRange.endDate);
    } else {
      loadDashboard(newRange);
    }
  };

  const handleApplyCustom = () => {
    const validation = validateCustomRange(customStartDate, customEndDate);
    if (!validation.isValid) {
      setCustomError(validation.error || 'Invalid date range.');
      return;
    }
    setCustomError(null);
    const newRange: DateRange = { startDate: customStartDate, endDate: customEndDate };
    setDateRange(newRange);
  };

  const handleRefresh = () => {
    loadDashboard(dateRange);
  };

  /* ─── Polling & Initial Fetch ───────────────────────────────── */

  useEffect(() => {
    if (employee && employee.role !== 'OWNER') {
      return;
    }

    isMountedRef.current = true;
    loadDashboard(dateRange);

    pollTimerRef.current = setInterval(() => {
      loadDashboard(dateRange, true);
    }, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [dateRange, loadDashboard, employee]);

  /* ─── Render States ─────────────────────────────────────────── */

  if (employee && employee.role !== 'OWNER') {
    return null;
  }

  if (loading && !data) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app, #F3F4F6)',
        }}
      >
        <LoadingState message="Loading dashboard..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: 'var(--bg-app, #F3F4F6)',
        }}
      >
        <ErrorState message={error} onRetry={() => loadDashboard(dateRange)} />
      </div>
    );
  }

  if (!data) return null;

  const {
    overview,
    financial,
    orders,
    readyOrders,
    recentOrders,
    recentActivity,
    comparison,
    trends,
    serviceBreakdown,
    categoryBreakdown,
    actionQueues,
  } = data;

  const inProcessCount =
    orders.processing +
    orders.sorting +
    orders.drying +
    orders.ironing +
    orders.qualityCheck +
    orders.packed;

  const activeOrders = inProcessCount + orders.received + orders.ready + orders.outForDelivery;

  // Status filter tabs
  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: overview.totalOrders },
    { key: 'RECEIVED', label: 'Received', count: orders.received },
    {
      key: 'PROCESSING',
      label: 'Processing',
      count:
        orders.processing +
        orders.sorting +
        orders.drying +
        orders.ironing +
        orders.qualityCheck +
        orders.packed,
    },
    { key: 'READY', label: 'Ready', count: orders.ready },
    { key: 'DELIVERED', label: 'Delivered', count: orders.delivered },
  ];

  // Filter recent orders by status
  const filteredOrders =
    statusFilter === 'ALL'
      ? recentOrders
      : statusFilter === 'PROCESSING'
        ? recentOrders.filter((o) =>
            ['PROCESSING', 'SORTING', 'DRYING', 'IRONING', 'QUALITY_CHECK', 'PACKED'].includes(
              o.status,
            ),
          )
        : recentOrders.filter((o) => o.status === statusFilter);

  const isOwner = employee?.role === 'OWNER';

  /* ─── Quick Actions ─────────────────────────────────────────── */

  const quickActions = [
    { label: '+ New Order', path: '/orders/new', show: true },
    { label: 'Customers', path: '/', show: true },
    { label: 'Catalog', path: '/catalog', show: true },
    { label: 'Staff', path: '/staff', show: isOwner },
    // Deliveries temporarily hidden while Home Delivery is not offered
    { label: 'Deliveries', path: '/deliveries', show: false },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app, #F3F4F6)',
        color: 'var(--text-primary, #111827)',
        display: 'flex',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* ─── SIDEBAR NAVIGATION (Desktop) ────────────────────────── */}
      <aside
        className="hidden md:flex flex-col"
        style={{
          width: '220px',
          minWidth: '220px',
          background: 'var(--bg-surface, #FFFFFF)',
          borderRight: '1px solid var(--border, #E2E8F0)',
          padding: '24px 14px',
          boxShadow: 'var(--shadow-neu-card-sm)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 8px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#EFF6FF',
              border: '1px solid #DBEAFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)',
            }}
          >
            <GrowFastLogo size={28} />
          </div>
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--text-primary, #0F172A)',
              letterSpacing: '-0.02em',
            }}
          >
            GrowFast
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            aria-label="Sidebar Dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--accent-muted, rgba(37, 99, 235, 0.12))',
              color: 'var(--accent, #2563EB)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/orders/new')}
            aria-label="Sidebar Create Order"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #475569)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.15s ease',
            }}
          >
            <PlusCircle size={18} />
            <span>Create Order</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/orders')}
            aria-label="Sidebar Orders"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #475569)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Package size={18} />
            <span>Orders</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Sidebar Customers"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #475569)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Users size={18} />
            <span>Customers</span>
          </button>

          {/* Deliveries sidebar button temporarily hidden while Home Delivery is not offered */}
          {/*
          <button
            type="button"
            onClick={() => navigate('/deliveries')}
            aria-label="Sidebar Deliveries"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #475569)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Truck size={18} />
            <span>Deliveries</span>
          </button>
          */}

          <button
            type="button"
            onClick={() => navigate('/catalog')}
            aria-label="Sidebar Catalog"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #475569)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Shirt size={18} />
            <span>Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/reports/daily-orders')}
            aria-label="Sidebar Reports"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #475569)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.15s ease',
            }}
          >
            <BarChart3 size={18} />
            <span>Reports</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/owner/settings')}
            aria-label="Sidebar Owner Settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #475569)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Settings size={18} />
            <span>Owner Settings</span>
          </button>
        </nav>
      </aside>

      {/* ─── MAIN DASHBOARD CONTENT AREA ─────────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          paddingBottom: 40,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '24px 28px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              id="dashboard-back-btn"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
              title="Return to Home"
              style={{
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
                borderRadius: '12px',
                border: '1px solid var(--border, #E2E8F0)',
                background: 'var(--bg-surface, #FFFFFF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #475569)',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: 'var(--shadow-neu-card-sm)',
                transition: 'all 0.15s ease',
              }}
              className="hover:text-[var(--text-primary)] hover:border-blue-400 active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--text-primary, #0F172A)',
                  letterSpacing: '-0.02em',
                }}
              >
                GrowFast Dashboard
              </h1>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted, #64748B)',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span>{todayLabel()}</span>
                {lastUpdated && (
                  <span style={{ opacity: 0.8 }}>
                    Last updated:{' '}
                    {lastUpdated.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              id="dashboard-branch-selector"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-surface, #FFFFFF)',
                border: '1px solid var(--border, #E2E8F0)',
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary, #0F172A)',
                boxShadow: 'var(--shadow-neu-card-sm)',
              }}
            >
              <Store size={15} color="#2563EB" />
              <span>{employee?.storeName || 'Koregaon Park Branch'}</span>
              <ChevronDown size={14} color="var(--text-muted, #64748B)" />
            </div>

            <ThemeToggle size="sm" />
          </div>
        </header>

        <div style={{ padding: '0 28px', maxWidth: 1400, width: '100%', boxSizing: 'border-box' }}>
          {/* ─── DATE FILTER TOOLBAR (Phase 2) ───────────────────── */}
          <div
            id="dashboard-date-filter-toolbar"
            role="region"
            aria-label="Dashboard period filters"
            style={{
              background: 'var(--bg-surface, #FFFFFF)',
              borderRadius: '16px',
              padding: '14px 20px',
              boxShadow: 'var(--shadow-neu-card-sm)',
              marginBottom: '24px',
              border: '1px solid var(--border, #E2E8F0)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              {/* Preset Buttons */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  alignItems: 'center',
                }}
                role="toolbar"
                aria-label="Period presets"
              >
                {PRESETS.map((p) => {
                  const isActive = preset === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleSelectPreset(p.key)}
                      aria-pressed={isActive}
                      style={{
                        minHeight: 40,
                        minWidth: 44,
                        padding: '8px 18px',
                        borderRadius: '9999px',
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        border: isActive ? 'none' : '1px solid var(--border, #CBD5E1)',
                        background: isActive
                          ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                          : 'var(--bg-surface, #FFFFFF)',
                        color: isActive ? '#FFFFFF' : 'var(--text-secondary, #475569)',
                        boxShadow: isActive ? '0 4px 12px rgba(37, 99, 235, 0.3)' : undefined,
                        transition: 'all 0.15s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={handleRefresh}
                aria-label="Refresh dashboard data"
                disabled={loading}
                style={{
                  minHeight: 40,
                  minWidth: 44,
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border, #CBD5E1)',
                  background: 'var(--bg-surface, #FFFFFF)',
                  color: 'var(--text-secondary, #475569)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: 'var(--shadow-neu-card-sm)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Active Period Range Descriptor */}
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 13,
                color: 'var(--text-secondary, #4B5563)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Active Period:</span>
                <span
                  id="dashboard-active-period-label"
                  style={{
                    fontWeight: 700,
                    color: 'var(--accent, #1E40AF)',
                    background: 'var(--accent-muted, #EFF6FF)',
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  {formatPeriodLabel(preset, dateRange.startDate, dateRange.endDate)}
                </span>
                {loading && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted, #6B7280)' }}>
                    (Updating...)
                  </span>
                )}
              </div>
            </div>

            {/* Custom Date Inputs (collapsible) */}
            {showCustomInputs && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border, #F3F4F6)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    From:
                    <input
                      type="date"
                      value={customStartDate}
                      max={todayKolkataStr}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setCustomError(null);
                      }}
                      aria-label="Start date"
                      style={{
                        minHeight: 44,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border, #D1D5DB)',
                        background: 'var(--bg-surface, #FFF)',
                        color: 'var(--text-primary, #111827)',
                        fontSize: 13,
                      }}
                    />
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    To:
                    <input
                      type="date"
                      value={customEndDate}
                      max={todayKolkataStr}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setCustomError(null);
                      }}
                      aria-label="End date"
                      style={{
                        minHeight: 44,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border, #D1D5DB)',
                        background: 'var(--bg-surface, #FFF)',
                        color: 'var(--text-primary, #111827)',
                        fontSize: 13,
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    style={{
                      minHeight: 44,
                      minWidth: 70,
                      padding: '8px 16px',
                      borderRadius: 6,
                      background: 'var(--accent, #2563EB)',
                      color: '#FFF',
                      fontWeight: 600,
                      fontSize: 13,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Apply
                  </button>
                </div>
                {customError && (
                  <div role="alert" style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
                    {customError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Banner when background fetch/refresh fails while showing existing data */}
          {error && data && (
            <div
              role="alert"
              style={{
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                padding: '10px 16px',
                borderRadius: 8,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 13,
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={handleRefresh}
                style={{
                  background: '#DC2626',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 36,
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* ─── FINANCIAL PERFORMANCE (Phase 3) ──────────────── */}
          <section aria-labelledby="financial-performance-heading" style={{ marginBottom: 24 }}>
            <SectionTitle id="financial-performance-heading">Financial Performance</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiCard
                id="kpi-collections-received"
                label="Collections Received"
                value={formatCurrency(financial.collections ?? financial.amountPaid)}
                comparison={comparison?.collections}
                isCurrency={true}
                sub={
                  financial.collectionCount !== undefined
                    ? `${financial.collectionCount} payment transaction${financial.collectionCount === 1 ? '' : 's'}`
                    : 'Collected in period'
                }
                color="#059669"
              />
              <KpiCard
                id="kpi-refunds"
                label="Refunds"
                value={formatCurrency(financial.refunds ?? 0)}
                isCurrency={true}
                sub={
                  financial.refundCount !== undefined
                    ? `${financial.refundCount} completed refund${financial.refundCount === 1 ? '' : 's'}`
                    : 'Completed refunds in period'
                }
                color={(financial.refunds ?? 0) > 0 ? '#DC2626' : 'var(--text-muted, #6B7280)'}
              />
              <KpiCard
                id="kpi-net-collections"
                label="Net Collections"
                value={formatCurrency(
                  financial.netCollections ??
                    (financial.collections ?? financial.amountPaid) - (financial.refunds ?? 0),
                )}
                comparison={comparison?.netCollections}
                isCurrency={true}
                sub="Collections minus refunds"
                color="#0D9488"
              />
              <KpiCard
                id="kpi-order-value-booked"
                label="Order Value Booked"
                value={formatCurrency(financial.bookedOrderValue ?? financial.totalOrderValue)}
                comparison={comparison?.bookedOrderValue}
                isCurrency={true}
                sub="Orders placed in period"
                color="#7C3AED"
              />
              <KpiCard
                id="kpi-outstanding-balance"
                label="Current Outstanding Balance"
                value={formatCurrency(financial.outstandingBalance ?? financial.amountDue)}
                isCurrency={true}
                badge="Live Snapshot"
                badgeVariant={
                  (financial.outstandingBalance ?? financial.amountDue) > 0 ? 'warning' : 'neutral'
                }
                sub="Current store-wide outstanding balance; not limited to the selected date range."
                color={
                  (financial.outstandingBalance ?? financial.amountDue) > 0 ? '#DC2626' : '#059669'
                }
                attention={(financial.outstandingBalance ?? financial.amountDue) > 0}
                onClick={() => {
                  setActionCenterQueue('PENDING_PAYMENT');
                  document
                    .getElementById('dashboard-action-center')
                    ?.scrollIntoView?.({ behavior: 'smooth' });
                }}
              />
            </div>
          </section>

          {/* ─── OPERATIONS & QUEUE HEALTH (Phase 3) ───────────── */}
          <section aria-labelledby="operational-health-heading" style={{ marginBottom: 24 }}>
            <SectionTitle id="operational-health-heading">
              Operations &amp; Queue Health
            </SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                id="kpi-orders-created"
                label="Orders Created"
                value={overview.totalOrders}
                comparison={comparison?.totalOrders}
                isCurrency={false}
                sub={`${activeOrders} active orders`}
                color="#2563EB"
                onClick={() => {
                  setStatusFilter('ALL');
                  document
                    .getElementById('order-status-overview')
                    ?.scrollIntoView?.({ behavior: 'smooth' });
                }}
              />
              <KpiCard
                id="kpi-in-process"
                label="In Process"
                value={inProcessCount}
                badge="Live Queue"
                badgeVariant="info"
                sub="Washing, drying, ironing & packing"
                color="#D97706"
                onClick={() => {
                  setStatusFilter('PROCESSING');
                  document
                    .getElementById('order-status-overview')
                    ?.scrollIntoView?.({ behavior: 'smooth' });
                }}
              />
              <KpiCard
                id="kpi-ready-pickup"
                label="Ready for Pickup"
                value={orders.ready}
                badge="Live Queue"
                badgeVariant="info"
                sub="Ready for customer collection"
                color="#059669"
                onClick={() => {
                  setStatusFilter('READY');
                  setActionCenterQueue('READY_FOR_PICKUP');
                  document
                    .getElementById('dashboard-action-center')
                    ?.scrollIntoView?.({ behavior: 'smooth' });
                }}
              />
              <KpiCard
                id="kpi-overdue-orders"
                label="Overdue Orders"
                value={orders.overdue}
                badge="Live Queue"
                badgeVariant={orders.overdue > 0 ? 'warning' : 'neutral'}
                sub="Past effective due date"
                color={orders.overdue > 0 ? '#DC2626' : '#6B7280'}
                attention={orders.overdue > 0}
                onClick={() => {
                  setActionCenterQueue('OVERDUE');
                  document
                    .getElementById('dashboard-action-center')
                    ?.scrollIntoView?.({ behavior: 'smooth' });
                }}
              />
              <KpiCard
                id="kpi-due-today"
                label="Due Today"
                value={orders.dueToday}
                badge="Asia/Kolkata"
                sub="Orders due today"
                color={orders.dueToday > 0 ? '#D97706' : '#6B7280'}
              />
              <KpiCard
                id="kpi-due-tomorrow"
                label="Due Tomorrow"
                value={orders.dueTomorrow ?? 0}
                badge="Asia/Kolkata"
                sub="Orders due tomorrow"
                color={(orders.dueTomorrow ?? 0) > 0 ? '#4B5563' : '#6B7280'}
              />
            </div>
          </section>

          {/* ─── TRENDS & PERFORMANCE (Phase 4) ──────────────── */}
          <section aria-labelledby="trends-performance-heading" style={{ marginBottom: 24 }}>
            <SectionTitle id="trends-performance-heading">Trends &amp; Performance</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DashboardTrendChart trends={trends} currencyFormatter={formatCurrency} />
              <DashboardBreakdownChart
                serviceBreakdown={serviceBreakdown}
                categoryBreakdown={categoryBreakdown}
                currencyFormatter={formatCurrency}
              />
            </div>
          </section>

          {/* ─── ACTION CENTER (Phase 5) ─────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <DashboardActionCenter
              actionQueues={actionQueues}
              readyOrders={readyOrders}
              currencyFormatter={formatCurrency}
              activeQueue={actionCenterQueue}
              onQueueChange={setActionCenterQueue}
            />
          </div>

          {/* ─── ORDER STATUS OVERVIEW ───────────────────────── */}
          <SectionTitle id="order-status-overview">Order Status</SectionTitle>
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
            }}
          >
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                aria-pressed={statusFilter === tab.key}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border:
                    statusFilter === tab.key
                      ? '2px solid var(--accent, #3B82F6)'
                      : '1px solid var(--border, #E5E7EB)',
                  background:
                    statusFilter === tab.key
                      ? 'var(--accent-muted, #EFF6FF)'
                      : 'var(--bg-surface, #FFF)',
                  color:
                    statusFilter === tab.key
                      ? 'var(--accent, #1E40AF)'
                      : 'var(--text-secondary, #6B7280)',
                  fontWeight: statusFilter === tab.key ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  minHeight: 44,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab.label}
                <span
                  style={{
                    background:
                      statusFilter === tab.key
                        ? 'var(--accent, #3B82F6)'
                        : 'var(--bg-surface-muted, #E5E7EB)',
                    color: statusFilter === tab.key ? '#FFF' : 'var(--text-primary, #374151)',
                    borderRadius: 10,
                    padding: '2px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ─── PAYMENT SUMMARY ─────────────────────────────── */}
          <SectionTitle>Payment Summary</SectionTitle>
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <PaymentRow
                label="Booked Order Value"
                value={formatCurrency(financial.bookedOrderValue ?? financial.totalOrderValue)}
              />
              <PaymentRow
                label="Collections Received"
                value={formatCurrency(financial.collections ?? financial.amountPaid)}
                color="var(--success-text, #059669)"
              />
              {financial.refunds !== undefined && financial.refunds > 0 && (
                <>
                  <PaymentRow
                    label="Completed Refunds"
                    value={formatCurrency(financial.refunds)}
                    color="var(--danger-text, #DC2626)"
                  />
                  <PaymentRow
                    label="Net Collections"
                    value={formatCurrency(
                      financial.netCollections ?? financial.amountPaid - financial.refunds,
                    )}
                    color="var(--success-text, #059669)"
                  />
                </>
              )}
              <PaymentRow
                label="Live Store-wide Outstanding"
                value={formatCurrency(financial.outstandingBalance ?? financial.amountDue)}
                color={
                  (financial.outstandingBalance ?? financial.amountDue) > 0
                    ? 'var(--danger-text, #DC2626)'
                    : undefined
                }
              />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted, #6B7280)',
                  fontStyle: 'italic',
                  marginTop: 2,
                }}
              >
                * Outstanding balance is a live store-wide snapshot, independent of the selected
                period.
              </div>
              <div
                style={{
                  borderTop: '1px solid var(--border, #E5E7EB)',
                  paddingTop: 8,
                  marginTop: 4,
                }}
              >
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                  <span style={{ color: 'var(--success-text, #059669)' }}>
                    ✓ Fully Paid: <strong>{financial.paidOrders}</strong>
                  </span>
                  <span style={{ color: 'var(--warning-text, #D97706)' }}>
                    ◑ Partial: <strong>{financial.partialOrders}</strong>
                  </span>
                  <span style={{ color: 'var(--danger-text, #DC2626)' }}>
                    ○ Unpaid: <strong>{financial.pendingOrders}</strong>
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* ─── RECENT ORDERS ───────────────────────────────── */}
          <SectionTitle>Recent Orders</SectionTitle>
          {filteredOrders.length === 0 ? (
            <Card style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #9CA3AF)' }}>
              {statusFilter === 'ALL'
                ? preset === 'TODAY'
                  ? 'No orders today'
                  : 'No orders in selected period'
                : `No ${statusFilter.toLowerCase()} orders`}
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredOrders.map((o) => (
                <Card
                  key={o.id}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}
                  onClick={() => navigate(`/orders/${o.id}`)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: 'var(--text-primary, #111827)',
                        }}
                      >
                        #{o.orderNumber}
                        <span
                          style={{
                            fontWeight: 400,
                            color: 'var(--text-muted, #6B7280)',
                            marginLeft: 8,
                          }}
                        >
                          {o.customerName}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-placeholder, #9CA3AF)',
                          marginTop: 2,
                        }}
                      >
                        {o.itemCount} items • {formatCurrency(o.totalAmount)}
                        {o.amountDue > 0 && (
                          <span style={{ color: 'var(--danger-text, #DC2626)', marginLeft: 8 }}>
                            Due: {formatCurrency(o.amountDue)}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusChip status={o.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ─── QUICK ACTIONS ───────────────────────────────── */}
          <SectionTitle>Quick Actions</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 8,
            }}
          >
            {quickActions
              .filter((a) => a.show)
              .map((a) => (
                <Button
                  key={a.path}
                  variant={a.path === '/orders/new' ? 'primary' : 'secondary'}
                  style={{ minHeight: 48, fontSize: 14, fontWeight: 600 }}
                  onClick={() => navigate(a.path)}
                >
                  {a.label}
                </Button>
              ))}
          </div>

          {/* ─── RECENT ACTIVITY (Phase 5) ───────────────────── */}
          <section
            aria-labelledby="recent-activity-heading"
            style={{ marginTop: 24, marginBottom: 24 }}
          >
            <SectionTitle id="recent-activity-heading">Recent Activity</SectionTitle>
            {recentActivity.length === 0 ? (
              <Card
                id="recent-activity-empty"
                style={{
                  padding: 24,
                  textAlign: 'center',
                  border: '1px dashed var(--border, #E5E7EB)',
                  background: 'var(--bg-surface, #FFF)',
                  color: 'var(--text-muted, #6B7280)',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
                <div
                  style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary, #111827)' }}
                >
                  No recent activity recorded
                </div>
                <div
                  style={{ fontSize: 12, color: 'var(--text-placeholder, #9CA3AF)', marginTop: 4 }}
                >
                  Order status changes and payment notifications for the selected period will appear
                  here.
                </div>
              </Card>
            ) : (
              <Card style={{ padding: 0 }} id="recent-activity-card">
                <div role="list" aria-label="Recent activity events">
                  {recentActivity.map((act, idx) => {
                    const hasOrderLink = Boolean(act.orderId);
                    return (
                      <div
                        key={act.id}
                        role="listitem"
                        tabIndex={hasOrderLink ? 0 : undefined}
                        onClick={
                          hasOrderLink ? () => navigate(`/orders/${act.orderId}`) : undefined
                        }
                        onKeyDown={
                          hasOrderLink
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/orders/${act.orderId}`);
                                }
                              }
                            : undefined
                        }
                        style={{
                          padding: '12px 16px',
                          borderBottom:
                            idx < recentActivity.length - 1
                              ? '1px solid var(--border, #F3F4F6)'
                              : undefined,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          fontSize: 13,
                          cursor: hasOrderLink ? 'pointer' : 'default',
                          transition: 'background-color 0.15s ease',
                        }}
                        className={
                          hasOrderLink ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''
                        }
                        aria-label={
                          hasOrderLink
                            ? `${act.message}${act.orderNumber ? ` for order #${act.orderNumber}` : ''}. Press to view order.`
                            : undefined
                        }
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <span style={{ fontSize: 18, flexShrink: 0 }} aria-hidden="true">
                            {ACTIVITY_ICONS[act.eventType] || '📢'}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <span
                              style={{ color: 'var(--text-primary, #374151)', fontWeight: 500 }}
                            >
                              {act.message}
                            </span>
                            {act.orderNumber && (
                              <span
                                style={{
                                  color: hasOrderLink
                                    ? 'var(--accent, #2563EB)'
                                    : 'var(--text-muted, #6B7280)',
                                  fontWeight: 600,
                                  marginLeft: 6,
                                }}
                              >
                                #{act.orderNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                        >
                          <span
                            style={{
                              color: 'var(--text-placeholder, #9CA3AF)',
                              fontSize: 11,
                              fontFamily: 'monospace',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTime(act.createdAt)}
                          </span>
                          {hasOrderLink && (
                            <span
                              style={{
                                fontSize: 12,
                                color: 'var(--accent, #2563EB)',
                                fontWeight: 600,
                              }}
                              className="hidden sm:inline"
                            >
                              View →
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

/* ─── Sub-Components ────────────────────────────────────────────── */

function ComparisonBadge({
  comparison,
  isCurrency = false,
}: {
  comparison: MetricComparison;
  isCurrency?: boolean;
}) {
  const { current, previous, percentageChange } = comparison;

  const formattedPrev = isCurrency ? formatCurrency(previous) : previous.toLocaleString('en-IN');

  // Case 1: Standard comparison with percentageChange available (previous > 0)
  if (percentageChange !== null && !isNaN(percentageChange)) {
    if (percentageChange > 0) {
      return (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            marginTop: 4,
            flexWrap: 'wrap',
          }}
          aria-label={`Increased by ${percentageChange}% compared to previous period`}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: '2px 6px',
              borderRadius: 4,
              background: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
            }}
          >
            <span>↑</span>
            <span>+{percentageChange}%</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)' }}>
            vs {formattedPrev} prev
          </span>
        </div>
      );
    }

    if (percentageChange < 0) {
      if (current === 0) {
        return (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              marginTop: 4,
              flexWrap: 'wrap',
            }}
            aria-label={`No activity this period compared to ${formattedPrev} previous`}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'var(--bg-surface-muted, #F3F4F6)',
                color: 'var(--text-secondary, #4B5563)',
                border: '1px solid var(--border, #E5E7EB)',
              }}
            >
              <span>—</span>
              <span>No activity</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)' }}>
              vs {formattedPrev} prev
            </span>
          </div>
        );
      }

      return (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            marginTop: 4,
            flexWrap: 'wrap',
          }}
          aria-label={`Decreased by ${Math.abs(percentageChange)}% compared to previous period`}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: '2px 6px',
              borderRadius: 4,
              background: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
            }}
          >
            <span>↓</span>
            <span>{percentageChange}%</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)' }}>
            vs {formattedPrev} prev
          </span>
        </div>
      );
    }

    // Unchanged (0%)
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          fontWeight: 600,
          marginTop: 4,
          flexWrap: 'wrap',
        }}
        aria-label="Unchanged compared to previous period"
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--bg-surface-muted, #F3F4F6)',
            color: 'var(--text-secondary, #4B5563)',
            border: '1px solid var(--border, #E5E7EB)',
          }}
        >
          <span>—</span>
          <span>0%</span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)' }}>
          vs {formattedPrev} prev
        </span>
      </div>
    );
  }

  // Case 2: Zero-baseline convention (previous was 0, current > 0)
  if (current > 0) {
    const formattedChange = isCurrency ? formatCurrency(current) : current.toLocaleString('en-IN');
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          fontWeight: 600,
          marginTop: 4,
          flexWrap: 'wrap',
        }}
        aria-label={`Increase of ${formattedChange} from zero baseline`}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            padding: '2px 6px',
            borderRadius: 4,
            background: '#EFF6FF',
            color: '#1E40AF',
            border: '1px solid #BFDBFE',
          }}
        >
          <span>↑</span>
          <span>+{formattedChange}</span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)' }}>
          vs {formattedPrev} prev
        </span>
      </div>
    );
  }

  // Both previous and current are 0
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        marginTop: 4,
        flexWrap: 'wrap',
      }}
      aria-label="Zero compared to previous period"
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 6px',
          borderRadius: 4,
          background: 'var(--bg-surface-muted, #F3F4F6)',
          color: 'var(--text-secondary, #4B5563)',
          border: '1px solid var(--border, #E5E7EB)',
        }}
      >
        <span>—</span>
        <span>0%</span>
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted, #6B7280)' }}>
        vs {formattedPrev} prev
      </span>
    </div>
  );
}

interface KpiCardProps {
  id?: string;
  label: string;
  value: string | number;
  sub?: string;
  comparison?: MetricComparison;
  isCurrency?: boolean;
  color?: string;
  attention?: boolean;
  badge?: string;
  badgeVariant?: 'neutral' | 'warning' | 'info';
  onClick?: () => void;
}

function KpiCard({
  id,
  label,
  value,
  sub,
  comparison,
  isCurrency = false,
  color,
  attention = false,
  badge,
  badgeVariant = 'neutral',
  onClick,
}: KpiCardProps) {
  const isClickable = Boolean(onClick);

  // Icon mapping according to reference image
  let iconNode: React.ReactNode = null;
  if (id === 'kpi-collections-received') iconNode = <Wallet size={16} />;
  else if (id === 'kpi-refunds') iconNode = <Receipt size={16} />;
  else if (id === 'kpi-net-collections') iconNode = <Coins size={16} />;
  else if (id === 'kpi-order-value-booked') iconNode = <ShoppingBag size={16} />;
  else if (id === 'kpi-orders-created') iconNode = <PlusCircle size={16} />;
  else if (id === 'kpi-due-today') iconNode = <Calendar size={16} />;
  else if (id === 'kpi-due-tomorrow') iconNode = <Clock size={16} />;

  const isLiveSnapshot = badge === 'Live Snapshot' || (badgeVariant === 'warning' && attention);
  const isLiveQueue = badge === 'Live Queue' || badgeVariant === 'info';

  return (
    <Card
      id={id}
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: isClickable ? 'pointer' : 'default',
        borderRadius: '16px',
        border: '1px solid var(--border, #E2E8F0)',
        background: 'var(--bg-surface, #FFFFFF)',
        boxShadow: 'var(--shadow-neu-card-sm)',
        transition: 'all 0.15s ease',
        minHeight: 124,
        height: '100%',
      }}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={isClickable ? `View ${label}` : undefined}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted, #64748B)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.025em',
            }}
          >
            {label}
          </span>
          {badge ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: isLiveSnapshot
                  ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                  : isLiveQueue
                    ? 'rgba(37, 99, 235, 0.15)'
                    : 'var(--bg-surface-muted, #F1F5F9)',
                color: isLiveSnapshot
                  ? '#FFFFFF'
                  : isLiveQueue
                    ? '#2563EB'
                    : 'var(--text-secondary, #475569)',
                border: isLiveQueue
                  ? '1px solid rgba(37, 99, 235, 0.3)'
                  : isLiveSnapshot
                    ? 'none'
                    : '1px solid var(--border, #CBD5E1)',
                boxShadow: isLiveSnapshot ? '0 2px 6px rgba(249, 115, 22, 0.35)' : undefined,
              }}
            >
              {badge}
            </span>
          ) : iconNode ? (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'var(--accent-muted, rgba(37, 99, 235, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent, #2563EB)',
              }}
            >
              {iconNode}
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: typeof value === 'string' && value.length > 10 ? 22 : 26,
            fontWeight: 800,
            color: color || 'var(--text-primary, #0F172A)',
            lineHeight: 1.25,
            marginTop: 8,
          }}
        >
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        {comparison && <ComparisonBadge comparison={comparison} isCurrency={isCurrency} />}
        {sub && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted, #64748B)',
              marginTop: comparison ? 4 : 2,
              lineHeight: 1.35,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </Card>
  );
}

function SummaryCard(props: KpiCardProps) {
  return <KpiCard {...props} />;
}

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      style={{
        fontSize: 16,
        fontWeight: 700,
        margin: '24px 0 12px 0',
        color: 'var(--text-primary, #111827)',
      }}
    >
      {children}
    </h2>
  );
}

function PaymentRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
      <span style={{ color: 'var(--text-muted, #6B7280)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--text-primary, #111827)' }}>
        {value}
      </span>
    </div>
  );
}
