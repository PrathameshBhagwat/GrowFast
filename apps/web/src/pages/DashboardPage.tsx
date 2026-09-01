import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Button, LoadingState, ErrorState, EmptyState } from '@growfast/ui';
import type { DashboardSummaryDTO } from '@growfast/shared-types';
import { fetchDashboardSummary } from '../services/dashboard.api';

type DatePreset = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'custom';

function getDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case 'today':
      return { startDate: todayStart.toISOString(), endDate: todayEnd.toISOString() };
    case 'yesterday': {
      const yd = new Date(todayStart);
      yd.setDate(yd.getDate() - 1);
      const yde = new Date(yd);
      yde.setHours(23, 59, 59, 999);
      return { startDate: yd.toISOString(), endDate: yde.toISOString() };
    }
    case '7days': {
      const d7 = new Date(todayStart);
      d7.setDate(d7.getDate() - 6);
      return { startDate: d7.toISOString(), endDate: todayEnd.toISOString() };
    }
    case '30days': {
      const d30 = new Date(todayStart);
      d30.setDate(d30.getDate() - 29);
      return { startDate: d30.toISOString(), endDate: todayEnd.toISOString() };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: monthStart.toISOString(), endDate: todayEnd.toISOString() };
    }
    default:
      return { startDate: todayStart.toISOString(), endDate: todayEnd.toISOString() };
  }
}

const KPI_CARD_STYLE: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 140,
  flex: '1 1 140px',
};

const KPI_VALUE_STYLE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.2,
};

const KPI_LABEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: '#6B7280',
  fontWeight: 500,
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  margin: '24px 0 12px 0',
  color: '#111827',
};

const GRID_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
};

interface KpiCardProps {
  label: string;
  value: number | string;
  color?: string;
  attention?: boolean;
  prefix?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, color, attention, prefix }) => (
  <Card
    style={{
      ...KPI_CARD_STYLE,
      borderLeft: attention ? '4px solid #F59E0B' : undefined,
    }}
  >
    <div style={{ ...KPI_VALUE_STYLE, color: color || '#111827' }}>
      {prefix}
      {typeof value === 'number' ? value.toLocaleString() : value}
    </div>
    <div style={KPI_LABEL_STYLE}>{label}</div>
  </Card>
);

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<DatePreset>('today');
  const requestIdRef = useRef(0);

  const loadDashboard = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const range = getDateRange(preset);
      const result = await fetchDashboardSummary(range.startDate, range.endDate);
      // Prevent stale response from overwriting newer data
      if (requestId === requestIdRef.current) {
        setData(result);
      }
    } catch (err: any) {
      if (requestId === requestIdRef.current) {
        setError(err.message || 'Failed to load dashboard');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [preset]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: '7days', label: '7 Days' },
    { key: '30days', label: '30 Days' },
    { key: 'month', label: 'This Month' },
  ];

  if (loading) return <LoadingState message="Loading dashboard..." fullPage />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;
  if (!data) return <EmptyState message="No dashboard data available" />;

  const { overview, orders, financial, delivery, customers } = data;

  return (
    <div style={{ padding: '16px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>📊 Dashboard</h1>
        <Button variant="secondary" onClick={loadDashboard} style={{ minHeight: 44 }}>
          ↻ Refresh
        </Button>
      </div>

      {/* Date Presets */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: preset === p.key ? '2px solid #3B82F6' : '1px solid #E5E7EB',
              background: preset === p.key ? '#EFF6FF' : '#FFF',
              color: preset === p.key ? '#1E40AF' : '#6B7280',
              fontWeight: preset === p.key ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              minHeight: 44,
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ─── Overview ─────────────────────────────────── */}
      <div style={SECTION_TITLE_STYLE}>Overview</div>
      <div style={GRID_STYLE}>
        <KpiCard label="Total Orders" value={overview.totalOrders} color="#1E40AF" />
        <KpiCard label="Total Items" value={overview.totalItems} color="#6D28D9" />
        <KpiCard label="Customers" value={overview.totalCustomers} color="#0891B2" />
      </div>

      {/* ─── Orders ──────────────────────────────────── */}
      <div style={SECTION_TITLE_STYLE}>Orders</div>
      <div style={GRID_STYLE}>
        <KpiCard label="Received" value={orders.received} color="#075985" />
        <KpiCard label="Processing" value={orders.processing} color="#92400E" />
        <KpiCard label="Ready" value={orders.ready} color="#065F46" />
        <KpiCard label="Out for Delivery" value={orders.outForDelivery} color="#1E40AF" />
        <KpiCard label="Delivered" value={orders.delivered} color="#166534" />
        <KpiCard label="Cancelled" value={orders.cancelled} color="#991B1B" />
      </div>
      <div style={{ ...GRID_STYLE, marginTop: 12 }}>
        <KpiCard
          label="⚠ Overdue"
          value={orders.overdue}
          color="#DC2626"
          attention={orders.overdue > 0}
        />
        <KpiCard
          label="⏰ Due Today"
          value={orders.dueToday}
          color="#D97706"
          attention={orders.dueToday > 0}
        />
      </div>

      {/* ─── Financial ───────────────────────────────── */}
      <div style={SECTION_TITLE_STYLE}>Financial</div>
      <div style={GRID_STYLE}>
        <KpiCard label="Total Value" value={financial.totalOrderValue} color="#1E40AF" prefix="₹" />
        <KpiCard label="Collected" value={financial.amountPaid} color="#166534" prefix="₹" />
        <KpiCard
          label="Outstanding"
          value={financial.amountDue}
          color="#DC2626"
          prefix="₹"
          attention={financial.amountDue > 0}
        />
      </div>
      <div style={{ ...GRID_STYLE, marginTop: 12 }}>
        <KpiCard label="Paid Orders" value={financial.paidOrders} color="#166534" />
        <KpiCard label="Partial Payment" value={financial.partialOrders} color="#D97706" />
        <KpiCard
          label="Pending Payment"
          value={financial.pendingOrders}
          color="#991B1B"
          attention={financial.pendingOrders > 0}
        />
      </div>

      {/* ─── Delivery ────────────────────────────────── */}
      <div style={SECTION_TITLE_STYLE}>Delivery</div>
      <div style={GRID_STYLE}>
        <KpiCard label="Scheduled" value={delivery.scheduled} color="#075985" />
        <KpiCard label="Assigned" value={delivery.assigned} color="#92400E" />
        <KpiCard label="In Transit" value={delivery.inTransit} color="#1E40AF" />
        <KpiCard label="Completed" value={delivery.completed} color="#166534" />
        <KpiCard
          label="Failed"
          value={delivery.failed}
          color="#DC2626"
          attention={delivery.failed > 0}
        />
      </div>

      {/* ─── Customers ───────────────────────────────── */}
      <div style={SECTION_TITLE_STYLE}>Customers</div>
      <div style={GRID_STYLE}>
        <KpiCard label="Total Customers" value={customers.total} color="#0891B2" />
        <KpiCard label="New This Period" value={customers.newInPeriod} color="#059669" />
      </div>
    </div>
  );
};
