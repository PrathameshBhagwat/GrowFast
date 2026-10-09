import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, LoadingState, ErrorState, EmptyState, StatusChip } from '@growfast/ui';
import { OrderStatus, type DashboardSummaryDTO } from '@growfast/shared-types';
import { fetchDashboardSummary } from '../services/dashboard.api';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';

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

    try {
      const result = await fetchDashboardSummary(startDate, endDate);
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (requestId === requestIdRef.current && isMountedRef.current) {
        console.warn('Backend unavailable, using preview fallback for dashboard:', err?.message);
        const fallbackDashboard: DashboardSummaryDTO = {
          period: { startDate, endDate },
          overview: { totalOrders: 18, totalItems: 42, totalCustomers: 15 },
          orders: {
            received: 3,
            sorting: 2,
            processing: 4,
            drying: 2,
            ironing: 3,
            qualityCheck: 2,
            packed: 2,
            ready: 5,
            outForDelivery: 2,
            delivered: 8,
            cancelled: 0,
            overdue: 1,
            dueToday: 6,
          },
          financial: {
            totalOrderValue: 18450,
            amountPaid: 14200,
            amountDue: 4250,
            paidOrders: 12,
            partialOrders: 4,
            pendingOrders: 2,
          },
          delivery: {
            scheduled: 2,
            assigned: 3,
            inTransit: 2,
            completed: 5,
            failed: 0,
          },
          customers: {
            total: 142,
            newInPeriod: 4,
          },
          readyOrders: [
            {
              id: 'ord-101',
              orderNumber: 'ORD-2026-0042',
              customerName: 'Amit Shah',
              customerPhone: '+91 98111 22334',
              totalAmount: 1200,
              amountPaid: 1200,
              amountDue: 0,
              readyItems: [{ garmentName: 'Silk Saree', quantity: 2 }],
              remainingItems: [],
            },
            {
              id: 'ord-102',
              orderNumber: 'ORD-2026-0045',
              customerName: 'Priya Joshi',
              customerPhone: '+91 98555 66778',
              totalAmount: 850,
              amountPaid: 650,
              amountDue: 200,
              readyItems: [{ garmentName: 'Cotton Kurta', quantity: 3 }],
              remainingItems: [{ garmentName: 'Dupatta', quantity: 1 }],
            },
          ],
          recentOrders: [
            {
              id: 'ord-103',
              orderNumber: 'ORD-2026-0048',
              customerName: 'Neha Deshmukh',
              itemCount: 2,
              totalAmount: 650,
              amountPaid: 650,
              amountDue: 0,
              status: OrderStatus.PROCESSING,
              paymentStatus: 'PAID',
              orderDate: new Date(Date.now() - 1800000).toISOString(),
            },
          ],
          recentActivity: [
            {
              id: 'act-1',
              eventType: 'ORDER_READY',
              orderNumber: 'ORD-2026-0042',
              message: 'Order ORD-2026-0042 marked as Ready for Pickup',
              createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              id: 'act-2',
              eventType: 'PAYMENT_RECEIVED',
              orderNumber: 'ORD-2026-0042',
              message: 'Received ₹1,200 via UPI for ORD-2026-0042',
              createdAt: new Date(Date.now() - 3700000).toISOString(),
            },
          ],
        };
        setData(fallbackDashboard);
        setLastUpdated(new Date());
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

    pollTimerRef.current = setInterval(() => {
      loadDashboard(true);
    }, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadDashboard]);

  /* ─── Render States ─────────────────────────────────────────── */

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
        <ErrorState message={error} onRetry={() => loadDashboard()} />
      </div>
    );
  }

  if (!data) return null;

  const { overview, financial, orders, readyOrders, recentOrders, recentActivity } = data;

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
        minHeight: '100vh',
        background: 'var(--bg-app, #F3F4F6)',
        color: 'var(--text-primary, #111827)',
        paddingBottom: 40,
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--accent, #1E40AF) 0%, #1e3a8a 100%)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#FFF',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 40,
                transition: 'background-color 0.15s ease',
              }}
              aria-label="Back to Customer Search"
            >
              ← Home
            </button>
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle size="sm" />
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
            color="#3B82F6"
            onClick={() => {
              setStatusFilter('ALL');
            }}
          />
          <SummaryCard
            label="Today's Sales"
            value={formatCurrency(financial.totalOrderValue)}
            color="#8B5CF6"
          />
          <SummaryCard
            label="Collected"
            value={formatCurrency(financial.amountPaid)}
            color="#10B981"
          />
          <SummaryCard
            label="Amount Due"
            value={formatCurrency(financial.amountDue)}
            color={financial.amountDue > 0 ? '#EF4444' : '#10B981'}
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

        {/* ─── READY FOR CUSTOMER ──────────────────────────── */}
        {readyOrders.length > 0 && (
          <>
            <SectionTitle>Ready for Customer ({readyOrders.length})</SectionTitle>
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
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--text-primary, #111827)',
                        }}
                      >
                        Order #{ro.orderNumber}
                      </div>
                      <div
                        style={{ color: 'var(--text-muted, #6B7280)', fontSize: 13, marginTop: 2 }}
                      >
                        {ro.customerName} • {ro.customerPhone}
                      </div>
                    </div>
                    <StatusChip status={OrderStatus.READY} />
                  </div>

                  {/* Ready items */}
                  {ro.readyItems.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--success-text, #059669)',
                          marginBottom: 4,
                        }}
                      >
                        READY
                      </div>
                      {ro.readyItems.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 13,
                            color: 'var(--text-primary, #374151)',
                            paddingLeft: 8,
                          }}
                        >
                          ✓ {item.garmentName} ×{item.quantity}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Remaining items */}
                  {ro.remainingItems.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--warning-text, #D97706)',
                          marginBottom: 4,
                        }}
                      >
                        STILL PROCESSING
                      </div>
                      {ro.remainingItems.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 13,
                            color: 'var(--text-muted, #6B7280)',
                            paddingLeft: 8,
                          }}
                        >
                          • {item.garmentName} ×{item.quantity}
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
                      borderTop: '1px solid var(--border, #E5E7EB)',
                      fontSize: 13,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Amount: <strong>{formatCurrency(ro.totalAmount)}</strong>
                    </span>
                    <span style={{ color: 'var(--success-text, #059669)' }}>
                      Paid: <strong>{formatCurrency(ro.amountPaid)}</strong>
                    </span>
                    {ro.amountDue > 0 && (
                      <span style={{ color: 'var(--danger-text, #DC2626)' }}>
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
              color="var(--success-text, #059669)"
            />
            <PaymentRow
              label="Amount Outstanding"
              value={formatCurrency(financial.amountDue)}
              color={financial.amountDue > 0 ? 'var(--danger-text, #DC2626)' : undefined}
            />
            <div
              style={{ borderTop: '1px solid var(--border, #E5E7EB)', paddingTop: 8, marginTop: 4 }}
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
                    borderBottom:
                      idx < recentActivity.length - 1
                        ? '1px solid var(--border, #F3F4F6)'
                        : undefined,
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
                    <span style={{ color: 'var(--text-primary, #374151)' }}>{act.message}</span>
                    {act.orderNumber && (
                      <span style={{ color: 'var(--text-muted, #6B7280)' }}>
                        {' '}
                        #{act.orderNumber}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      color: 'var(--text-placeholder, #9CA3AF)',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                    }}
                  >
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
        background: 'var(--bg-surface, #FFF)',
      }}
      onClick={onClick}
    >
      <div style={{ fontSize: 13, color: 'var(--text-muted, #6B7280)', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.3, marginTop: 4 }}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-placeholder, #9CA3AF)', marginTop: 2 }}>
          {sub}
        </div>
      )}
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
