import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, LoadingState, ErrorState, EmptyState, StatusChip } from '@growfast/ui';
import { OrderStatus, type DashboardSummaryDTO } from '@growfast/shared-types';
import { fetchDashboardSummary } from '../services/dashboard.api';
import { useAuth } from '../contexts/AuthContext';

const POLL_INTERVAL_MS = 30_000;

/* ─── Helpers ─────────────────────────────────────────────────── */

function formatCurrency(v: number): string {
  return '\u20b9' + v.toLocaleString('en-IN');
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
  const requestIdRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  /* ─── Data Fetching ─────────────────────────────────────────── */

  const loadDashboard = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      ).toISOString();
      const result = await fetchDashboardSummary(startDate, endDate);
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (requestId === requestIdRef.current && isMountedRef.current) {
        if (!silent) setError(err.message || 'Failed to load dashboard');
      }
    } finally {
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadDashboard();
    pollTimerRef.current = setInterval(() => loadDashboard(true), POLL_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadDashboard]);

  /* ─── Loading / Error / Empty ───────────────────────────────── */

  if (loading && !data) return <LoadingState message="Loading dashboard..." fullPage />;
  if (error && !data) return <ErrorState message={error} onRetry={() => loadDashboard()} />;
  if (!data) return <EmptyState message="No dashboard data available" />;

  const { overview, orders, financial, readyOrders, recentOrders, recentActivity } = data;

  // Compute active (non-terminal) order total
  const activeOrders =
    orders.received +
    orders.sorting +
    orders.processing +
    orders.drying +
    orders.ironing +
    orders.qualityCheck +
    orders.packed +
    orders.ready +
    orders.outForDelivery;

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
    { label: 'Deliveries', path: '/deliveries', show: true },
  ];

  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        background: '#F3F4F6',
        paddingBottom: 40,
      }}
    >
      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div
        style={{
          background: '#1E40AF',
          color: '#FFF',
          padding: '24px 16px 56px',
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>GrowFast Dashboard</h1>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{todayLabel()}</div>
            {lastUpdated && (
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
                Last updated:{' '}
                {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          <button
            onClick={() => loadDashboard()}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#FFF',
              borderRadius: 8,
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              minHeight: 44,
              minWidth: 44,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>
        {/* ─── TODAY'S SUMMARY ──────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginTop: -24,
          }}
        >
          <SummaryCard
            label="Today's Orders"
            value={overview.totalOrders}
            sub={`${activeOrders} active`}
            color="#1E40AF"
            onClick={() => {
              setStatusFilter('ALL');
            }}
          />
          <SummaryCard
            label="Today's Sales"
            value={formatCurrency(financial.totalOrderValue)}
            color="#7C3AED"
          />
          <SummaryCard
            label="Collected"
            value={formatCurrency(financial.amountPaid)}
            color="#059669"
          />
          <SummaryCard
            label="Amount Due"
            value={formatCurrency(financial.amountDue)}
            color={financial.amountDue > 0 ? '#DC2626' : '#059669'}
            attention={financial.amountDue > 0}
          />
        </div>

        {/* ─── ORDER STATUS OVERVIEW ───────────────────────── */}
        <SectionTitle>Order Status</SectionTitle>
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
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: statusFilter === tab.key ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                background: statusFilter === tab.key ? '#EFF6FF' : '#FFF',
                color: statusFilter === tab.key ? '#1E40AF' : '#6B7280',
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
                  background: statusFilter === tab.key ? '#3B82F6' : '#E5E7EB',
                  color: statusFilter === tab.key ? '#FFF' : '#374151',
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

        {/* ─── READY FOR CUSTOMER ──────────────────────────── */}
        {readyOrders.length > 0 && (
          <>
            <SectionTitle>\u2705 Ready for Customer ({readyOrders.length})</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {readyOrders.map((ro) => (
                <Card key={ro.id} style={{ padding: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Order #{ro.orderNumber}</div>
                      <div style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>
                        {ro.customerName} \u2022 {ro.customerPhone}
                      </div>
                    </div>
                    <StatusChip status={OrderStatus.READY} />
                  </div>

                  {/* Ready items */}
                  {ro.readyItems.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 4 }}
                      >
                        READY
                      </div>
                      {ro.readyItems.map((item, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#374151', paddingLeft: 8 }}>
                          ✓ {item.garmentName} ×{item.quantity}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Remaining items */}
                  {ro.remainingItems.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{ fontSize: 12, fontWeight: 600, color: '#D97706', marginBottom: 4 }}
                      >
                        STILL PROCESSING
                      </div>
                      {ro.remainingItems.map((item, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#6B7280', paddingLeft: 8 }}>
                          \u2022 {item.garmentName} \u00d7{item.quantity}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Financial */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid #E5E7EB',
                      fontSize: 13,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Amount: <strong>{formatCurrency(ro.totalAmount)}</strong>
                    </span>
                    <span style={{ color: '#059669' }}>
                      Paid: <strong>{formatCurrency(ro.amountPaid)}</strong>
                    </span>
                    {ro.amountDue > 0 && (
                      <span style={{ color: '#DC2626' }}>
                        Due: <strong>{formatCurrency(ro.amountDue)}</strong>
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <Button
                      variant="primary"
                      style={{ minHeight: 44, fontSize: 13 }}
                      onClick={() => navigate(`/orders/${ro.id}`)}
                    >
                      View Order
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ─── PAYMENT SUMMARY ─────────────────────────────── */}
        <SectionTitle>Payment Summary</SectionTitle>
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PaymentRow
              label="Total Order Value"
              value={formatCurrency(financial.totalOrderValue)}
            />
            <PaymentRow
              label="Amount Collected"
              value={formatCurrency(financial.amountPaid)}
              color="#059669"
            />
            <PaymentRow
              label="Amount Outstanding"
              value={formatCurrency(financial.amountDue)}
              color={financial.amountDue > 0 ? '#DC2626' : undefined}
            />
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                <span style={{ color: '#059669' }}>
                  ✓ Fully Paid: <strong>{financial.paidOrders}</strong>
                </span>
                <span style={{ color: '#D97706' }}>
                  ◑ Partial: <strong>{financial.partialOrders}</strong>
                </span>
                <span style={{ color: '#DC2626' }}>
                  ○ Unpaid: <strong>{financial.pendingOrders}</strong>
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* ─── RECENT ORDERS ───────────────────────────────── */}
        <SectionTitle>Recent Orders</SectionTitle>
        {filteredOrders.length === 0 ? (
          <Card style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
            {statusFilter === 'ALL' ? 'No orders today' : `No ${statusFilter.toLowerCase()} orders`}
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
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      #{o.orderNumber}
                      <span style={{ fontWeight: 400, color: '#6B7280', marginLeft: 8 }}>
                        {o.customerName}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {o.itemCount} items \u2022 {formatCurrency(o.totalAmount)}
                      {o.amountDue > 0 && (
                        <span style={{ color: '#DC2626', marginLeft: 8 }}>
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

        {/* ─── RECENT ACTIVITY ─────────────────────────────── */}
        {recentActivity.length > 0 && (
          <>
            <SectionTitle>Recent Activity</SectionTitle>
            <Card style={{ padding: 0 }}>
              {recentActivity.map((act, idx) => (
                <div
                  key={act.id}
                  style={{
                    padding: '10px 16px',
                    borderBottom: idx < recentActivity.length - 1 ? '1px solid #F3F4F6' : undefined,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 16 }}>
                    {ACTIVITY_ICONS[act.eventType] || '\ud83d\udce3'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#374151' }}>{act.message}</span>
                    {act.orderNumber && (
                      <span style={{ color: '#6B7280' }}> #{act.orderNumber}</span>
                    )}
                  </div>
                  <span style={{ color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {formatTime(act.createdAt)}
                  </span>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── Sub-Components ────────────────────────────────────────────── */

function SummaryCard({
  label,
  value,
  sub,
  color,
  attention,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  attention?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      style={{
        padding: 20,
        cursor: onClick ? 'pointer' : undefined,
        borderLeft: attention ? `4px solid ${color}` : undefined,
        background: '#FFF',
      }}
      onClick={onClick}
    >
      <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.3, marginTop: 4 }}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 16,
        fontWeight: 700,
        margin: '24px 0 12px 0',
        color: '#111827',
      }}
    >
      {children}
    </h2>
  );
}

function PaymentRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
      <span style={{ color: '#6B7280' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || '#111827' }}>{value}</span>
    </div>
  );
}
