import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardPage } from './DashboardPage';
import * as dashboardApi from '../services/dashboard.api';
import { formatKolkataDate, getDateRangeForPreset } from '../utils/dashboard-date';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
let mockEmployee = { id: 'emp-1', name: 'Ramesh Patel', role: 'OWNER', storeId: 'store-1' };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    employee: mockEmployee,
    isAuthenticated: true,
  }),
}));

describe('DashboardPage - Phase 2: Date Filters & Period Selection', () => {
  const mockDashboardData = {
    period: { startDate: '2026-10-21', endDate: '2026-10-21' },
    overview: { totalOrders: 12, totalItems: 34, totalCustomers: 10 },
    orders: {
      received: 2,
      sorting: 1,
      processing: 3,
      drying: 1,
      ironing: 2,
      qualityCheck: 1,
      packed: 1,
      ready: 3,
      outForDelivery: 1,
      delivered: 5,
      cancelled: 0,
      overdue: 1,
      dueToday: 4,
      dueTomorrow: 2,
    },
    financial: {
      totalOrderValue: 15400,
      amountPaid: 12100,
      amountDue: 3300,
      paidOrders: 8,
      partialOrders: 3,
      pendingOrders: 1,
      bookedOrderValue: 15400,
      collections: 12100,
      refunds: 600,
      netCollections: 11500,
      outstandingBalance: 3300,
    },
    delivery: {
      scheduled: 1,
      assigned: 2,
      inTransit: 1,
      completed: 4,
      failed: 0,
    },
    customers: {
      total: 85,
      newInPeriod: 2,
    },
    readyOrders: [
      {
        id: 'ord-ready-1',
        orderNumber: 'ORD-2026-0091',
        customerName: 'Anil Kumar',
        customerPhone: '+91 98111 00001',
        totalAmount: 1400,
        amountPaid: 1400,
        amountDue: 0,
        readyItems: [{ garmentName: 'Silk Kurta', quantity: 2 }],
        remainingItems: [],
      },
    ],
    recentOrders: [
      {
        id: 'ord-recent-1',
        orderNumber: 'ORD-2026-0092',
        customerName: 'Sunita Sharma',
        itemCount: 3,
        totalAmount: 850,
        amountPaid: 850,
        amountDue: 0,
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        orderDate: '2026-10-21T09:30:00.000Z',
      },
    ],
    recentActivity: [
      {
        id: 'act-1',
        eventType: 'ORDER_READY',
        orderNumber: 'ORD-2026-0091',
        message: 'Order ORD-2026-0091 marked as Ready for Pickup',
        createdAt: '2026-10-21T10:00:00.000Z',
      },
    ],
  };

  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmployee = { id: 'emp-1', name: 'Ramesh Patel', role: 'OWNER', storeId: 'store-1' };
    fetchSpy = vi
      .spyOn(dashboardApi, 'fetchDashboardSummary')
      .mockResolvedValue(mockDashboardData as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthorized COUNTER role away from dashboard to / without fetching data', async () => {
    mockEmployee = { id: 'emp-2', name: 'Counter Staff', role: 'COUNTER', storeId: 'store-1' };
    render(<DashboardPage />);

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // 1. Default Today selection
  it('1. Defaults to Today on initial load and passes today date parameters to API', async () => {
    render(<DashboardPage />);

    const todayStr = formatKolkataDate();
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(todayStr, todayStr, expect.any(AbortSignal));
    });

    const activePeriod = await screen.findByText(/Active Period:/i);
    expect(activePeriod).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
  });

  // 2. Yesterday date boundaries
  it('2. Switches to Yesterday range when clicked and passes yesterday boundaries', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const yesterdayBtn = screen.getByRole('button', { name: 'Yesterday' });
    fireEvent.click(yesterdayBtn);

    const yesterdayRange = getDateRangeForPreset('YESTERDAY');
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        yesterdayRange.startDate,
        yesterdayRange.endDate,
        expect.any(AbortSignal),
      );
    });
    expect(yesterdayBtn).toHaveAttribute('aria-pressed', 'true');
  });

  // 3. This Week starting on Monday
  it('3. Switches to This Week starting on Monday when clicked', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const weekBtn = screen.getByRole('button', { name: 'This Week' });
    fireEvent.click(weekBtn);

    const weekRange = getDateRangeForPreset('THIS_WEEK');
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        weekRange.startDate,
        weekRange.endDate,
        expect.any(AbortSignal),
      );
    });
    expect(weekBtn).toHaveAttribute('aria-pressed', 'true');
  });

  // 4. This Month starting on day one
  it('4. Switches to This Month starting on day one when clicked', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const monthBtn = screen.getByRole('button', { name: 'This Month' });
    fireEvent.click(monthBtn);

    const monthRange = getDateRangeForPreset('THIS_MONTH');
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        monthRange.startDate,
        monthRange.endDate,
        expect.any(AbortSignal),
      );
    });
    expect(monthBtn).toHaveAttribute('aria-pressed', 'true');
  });

  // 5. Custom date-range selection
  it('5. Allows entering and applying a valid custom date range', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const customBtn = screen.getByRole('button', { name: 'Custom Range' });
    fireEvent.click(customBtn);

    const startInput = screen.getByLabelText(/Start date/i);
    const endInput = screen.getByLabelText(/End date/i);
    const applyBtn = screen.getByRole('button', { name: /Apply/i });

    fireEvent.change(startInput, { target: { value: '2026-10-01' } });
    fireEvent.change(endInput, { target: { value: '2026-10-10' } });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('2026-10-01', '2026-10-10', expect.any(AbortSignal));
    });
  });

  // 6. Invalid and reversed ranges
  it('6. Rejects reversed ranges (start date after end date) with an inline alert', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const customBtn = screen.getByRole('button', { name: 'Custom Range' });
    fireEvent.click(customBtn);

    const startInput = screen.getByLabelText(/Start date/i);
    const endInput = screen.getByLabelText(/End date/i);
    const applyBtn = screen.getByRole('button', { name: /Apply/i });

    fireEvent.change(startInput, { target: { value: '2026-10-15' } });
    fireEvent.change(endInput, { target: { value: '2026-10-05' } });
    fireEvent.click(applyBtn);

    expect(await screen.findByText('Start date cannot be after end date.')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // 7. Future-date restrictions
  it('7. Rejects future dates for historical reporting', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const customBtn = screen.getByRole('button', { name: 'Custom Range' });
    fireEvent.click(customBtn);

    const startInput = screen.getByLabelText(/Start date/i);
    const endInput = screen.getByLabelText(/End date/i);
    const applyBtn = screen.getByRole('button', { name: /Apply/i });

    fireEvent.change(startInput, { target: { value: '2029-01-01' } });
    fireEvent.change(endInput, { target: { value: '2029-01-05' } });
    fireEvent.click(applyBtn);

    expect(
      await screen.findByText('Future dates are not permitted for historical reporting.'),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // 8. Correct API parameters for each selected range
  it('8. Sends date-only YYYY-MM-DD parameters without local timezone shift', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const todayStr = formatKolkataDate();
    const calls = fetchSpy.mock.calls;
    expect(calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(calls[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(calls[0][0]).toBe(todayStr);
  });

  // 9. Refresh using the existing selected range
  it('9. Refresh reloads data using the currently selected range without resetting selection', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    // Switch to Yesterday
    const yesterdayBtn = screen.getByRole('button', { name: 'Yesterday' });
    fireEvent.click(yesterdayBtn);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    // Click Refresh
    const refreshButtons = screen.getAllByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButtons[0]);

    const yesterdayRange = getDateRangeForPreset('YESTERDAY');
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy).toHaveBeenLastCalledWith(
        yesterdayRange.startDate,
        yesterdayRange.endDate,
        expect.any(AbortSignal),
      );
    });
    expect(yesterdayBtn).toHaveAttribute('aria-pressed', 'true');
  });

  // 10. Preventing stale responses from replacing newer results
  it('10. Prevents stale responses from overwriting newer selections', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    let resolveYesterday: any;
    let resolveWeek: any;

    fetchSpy
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveYesterday = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveWeek = resolve;
          }),
      );

    // Switch to Yesterday
    const yesterdayBtn = screen.getByRole('button', { name: 'Yesterday' });
    fireEvent.click(yesterdayBtn);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    // Switch to This Week
    const weekBtn = screen.getByRole('button', { name: 'This Week' });
    fireEvent.click(weekBtn);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));

    // Resolve second request first (This Week with 99 orders)
    await act(async () => {
      resolveWeek({
        ...mockDashboardData,
        overview: { ...mockDashboardData.overview, totalOrders: 99 },
      });
      await Promise.resolve();
    });

    // Resolve first request later (Yesterday with 12 orders)
    await act(async () => {
      resolveYesterday({
        ...mockDashboardData,
        overview: { ...mockDashboardData.overview, totalOrders: 12 },
      });
      await Promise.resolve();
    });

    // The display must show 99 orders (This Week), not overwritten by Yesterday
    await waitFor(() => {
      expect(screen.getAllByText('99').length).toBeGreaterThanOrEqual(1);
    });
  });

  // 11. Loading, error, and empty states
  it('11. Handles error state with retry path and does not fall back to fake mock data', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error 500'));

    render(<DashboardPage />);

    // Should show error state
    expect(await screen.findByText('Network error 500')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });

    // Mock success on retry
    fetchSpy.mockResolvedValueOnce(mockDashboardData as any);
    fireEvent.click(retryBtn);

    expect(await screen.findByText('GrowFast Dashboard')).toBeInTheDocument();
  });

  it('11b. Renders empty period correctly with zero counters rather than an error', async () => {
    const emptyData = {
      ...mockDashboardData,
      overview: { totalOrders: 0, totalItems: 0, totalCustomers: 0 },
      financial: {
        ...mockDashboardData.financial,
        totalOrderValue: 0,
        amountPaid: 0,
        bookedOrderValue: 0,
        collections: 0,
        refunds: 0,
        netCollections: 0,
        outstandingBalance: 3300,
      },
      readyOrders: [],
      recentOrders: [],
    };
    fetchSpy.mockResolvedValueOnce(emptyData as any);

    render(<DashboardPage />);

    expect(await screen.findByText('No orders today')).toBeInTheDocument();
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
  });

  // 12. Polling compatibility with currently selected range
  it('12. Background polling fetches the currently selected range instead of always Today', async () => {
    vi.useFakeTimers();
    try {
      render(<DashboardPage />);
      await act(async () => {
        await Promise.resolve();
      });

      // Switch to This Month
      const monthBtn = screen.getByRole('button', { name: 'This Month' });
      act(() => {
        fireEvent.click(monthBtn);
      });
      await act(async () => {
        await Promise.resolve();
      });

      const monthRange = getDateRangeForPreset('THIS_MONTH');

      // Fast-forward 30 seconds for polling
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(fetchSpy).toHaveBeenLastCalledWith(
        monthRange.startDate,
        monthRange.endDate,
        expect.any(AbortSignal),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // 16. Clear distinction between selected-period metrics and live outstanding balance
  it('16. Distinguishes period metrics from live store-wide outstanding balance with required label', async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByText(
        'Current store-wide outstanding balance; not limited to the selected date range.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        '* Outstanding balance is a live store-wide snapshot, independent of the selected period.',
      ),
    ).toBeInTheDocument();
  });
});

describe('DashboardPage - Phase 3: KPI Cards & Period Comparisons', () => {
  const basePhase3Data = {
    period: { startDate: '2026-10-21', endDate: '2026-10-21' },
    overview: { totalOrders: 12, totalItems: 34, totalCustomers: 10 },
    orders: {
      received: 2,
      sorting: 1,
      processing: 3,
      drying: 1,
      ironing: 2,
      qualityCheck: 1,
      packed: 1,
      ready: 3,
      outForDelivery: 1,
      delivered: 5,
      cancelled: 0,
      overdue: 1,
      dueToday: 4,
      dueTomorrow: 2,
    },
    financial: {
      totalOrderValue: 15400,
      amountPaid: 12100,
      amountDue: 3300,
      paidOrders: 8,
      partialOrders: 3,
      pendingOrders: 1,
      bookedOrderValue: 15400,
      collections: 12100,
      refunds: 600,
      netCollections: 11500,
      outstandingBalance: 3300,
      collectionCount: 8,
      refundCount: 1,
    },
    delivery: {
      scheduled: 1,
      assigned: 2,
      inTransit: 1,
      completed: 4,
      failed: 0,
    },
    customers: {
      total: 85,
      newInPeriod: 2,
    },
    readyOrders: [],
    recentOrders: [],
    recentActivity: [],
    comparison: {
      previousPeriod: { startDate: '2026-10-20', endDate: '2026-10-20' },
      bookedOrderValue: {
        current: 15400,
        previous: 14000,
        absoluteChange: 1400,
        percentageChange: 10,
      },
      collections: {
        current: 12100,
        previous: 10000,
        absoluteChange: 2100,
        percentageChange: 21,
      },
      netCollections: {
        current: 11500,
        previous: 12000,
        absoluteChange: -500,
        percentageChange: -4.17,
      },
      totalOrders: {
        current: 12,
        previous: 12,
        absoluteChange: 0,
        percentageChange: 0,
      },
    },
  };

  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi
      .spyOn(dashboardApi, 'fetchDashboardSummary')
      .mockResolvedValue(basePhase3Data as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all 5 Financial KPI cards with accurate backend values and Indian currency formatting', async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByRole('heading', { name: 'Financial Performance' }),
    ).toBeInTheDocument();

    // 1. Collections Received
    const collectionsCard = document.getElementById('kpi-collections-received');
    expect(collectionsCard).toBeInTheDocument();
    expect(within(collectionsCard!).getByText('Collections Received')).toBeInTheDocument();
    expect(within(collectionsCard!).getByText('₹12,100')).toBeInTheDocument();

    // 2. Refunds
    const refundsCard = document.getElementById('kpi-refunds');
    expect(refundsCard).toBeInTheDocument();
    expect(within(refundsCard!).getByText('Refunds')).toBeInTheDocument();
    expect(within(refundsCard!).getByText('₹600')).toBeInTheDocument();

    // 3. Net Collections
    const netCollectionsCard = document.getElementById('kpi-net-collections');
    expect(netCollectionsCard).toBeInTheDocument();
    expect(within(netCollectionsCard!).getByText('Net Collections')).toBeInTheDocument();
    expect(within(netCollectionsCard!).getByText('₹11,500')).toBeInTheDocument();

    // 4. Order Value Booked
    const bookedCard = document.getElementById('kpi-order-value-booked');
    expect(bookedCard).toBeInTheDocument();
    expect(within(bookedCard!).getByText('Order Value Booked')).toBeInTheDocument();
    expect(within(bookedCard!).getByText('₹15,400')).toBeInTheDocument();

    // 5. Current Outstanding Balance
    const balanceCard = document.getElementById('kpi-outstanding-balance');
    expect(balanceCard).toBeInTheDocument();
    expect(within(balanceCard!).getByText('Current Outstanding Balance')).toBeInTheDocument();
    expect(within(balanceCard!).getByText('₹3,300')).toBeInTheDocument();
  });

  it('renders all 6 Operational KPI cards with correct counts and queues', async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByRole('heading', { name: 'Operations & Queue Health' }),
    ).toBeInTheDocument();

    // 6. Orders Created (overview.totalOrders = 12)
    const ordersCard = document.getElementById('kpi-orders-created');
    expect(ordersCard).toBeInTheDocument();
    expect(within(ordersCard!).getByText('Orders Created')).toBeInTheDocument();
    expect(within(ordersCard!).getByText('12')).toBeInTheDocument();

    // 7. In Process (sorting:1 + processing:3 + drying:1 + ironing:2 + qualityCheck:1 + packed:1 = 9)
    const inProcessCard = document.getElementById('kpi-in-process');
    expect(inProcessCard).toBeInTheDocument();
    expect(within(inProcessCard!).getByText('In Process')).toBeInTheDocument();
    expect(within(inProcessCard!).getByText('9')).toBeInTheDocument();

    // 8. Ready for Pickup (orders.ready = 3)
    const readyCard = document.getElementById('kpi-ready-pickup');
    expect(readyCard).toBeInTheDocument();
    expect(within(readyCard!).getByText('Ready for Pickup')).toBeInTheDocument();
    expect(within(readyCard!).getByText('3')).toBeInTheDocument();

    // 9. Overdue Orders (orders.overdue = 1)
    const overdueCard = document.getElementById('kpi-overdue-orders');
    expect(overdueCard).toBeInTheDocument();
    expect(within(overdueCard!).getByText('Overdue Orders')).toBeInTheDocument();
    expect(within(overdueCard!).getByText('1')).toBeInTheDocument();

    // 10. Due Today (orders.dueToday = 4)
    const dueTodayCard = document.getElementById('kpi-due-today');
    expect(dueTodayCard).toBeInTheDocument();
    expect(within(dueTodayCard!).getByText('Due Today')).toBeInTheDocument();
    expect(within(dueTodayCard!).getByText('4')).toBeInTheDocument();

    // 11. Due Tomorrow (orders.dueTomorrow = 2)
    const dueTomorrowCard = document.getElementById('kpi-due-tomorrow');
    expect(dueTomorrowCard).toBeInTheDocument();
    expect(within(dueTomorrowCard!).getByText('Due Tomorrow')).toBeInTheDocument();
    expect(within(dueTomorrowCard!).getByText('2')).toBeInTheDocument();
  });

  it('displays positive, negative, and unchanged previous-period comparisons clearly', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Financial Performance' });

    // Positive comparison on collections: +21% vs ₹10,000 prev
    expect(screen.getByText('+21%')).toBeInTheDocument();
    expect(screen.getByText('vs ₹10,000 prev')).toBeInTheDocument();

    // Negative comparison on net collections: -4.17% vs ₹12,000 prev
    expect(screen.getByText('-4.17%')).toBeInTheDocument();
    expect(screen.getByText('vs ₹12,000 prev')).toBeInTheDocument();

    // Unchanged comparison on totalOrders: — 0% vs 12 prev
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('vs 12 prev')).toBeInTheDocument();
  });

  it('handles zero-baseline comparisons gracefully without NaN or Infinity', async () => {
    const zeroBaselineData = {
      ...basePhase3Data,
      comparison: {
        ...basePhase3Data.comparison,
        collections: {
          current: 5000,
          previous: 0,
          absoluteChange: 5000,
          percentageChange: null,
        },
        totalOrders: {
          current: 0,
          previous: 0,
          absoluteChange: 0,
          percentageChange: null,
        },
      },
    };
    fetchSpy.mockResolvedValueOnce(zeroBaselineData as any);

    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Financial Performance' });

    // Zero-baseline for collections (previous 0, current 5000): displays +₹5,000 vs ₹0 prev
    expect(screen.getByText('+₹5,000')).toBeInTheDocument();
    expect(screen.getByText('vs ₹0 prev')).toBeInTheDocument();

    // Both previous and current zero for total orders: displays — 0% vs 0 prev
    expect(screen.getByText('vs 0 prev')).toBeInTheDocument();
    expect(screen.queryByText(/\bNaN\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bInfinity\b/)).not.toBeInTheDocument();
  });

  it('clearly marks Outstanding Balance as a Live Snapshot without period comparisons', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Financial Performance' });

    // Outstanding balance card has Live Snapshot badge
    expect(screen.getByText('Live Snapshot')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Current store-wide outstanding balance; not limited to the selected date range.',
      ),
    ).toBeInTheDocument();

    // Should not have comparison badge under outstanding balance card
    const outstandingCard = document.getElementById('kpi-outstanding-balance');
    expect(outstandingCard).toBeInTheDocument();
    expect(outstandingCard?.textContent).not.toContain('vs ₹');
    expect(outstandingCard?.textContent).not.toContain('prev');
  });

  it('marks live queue semantics on operational cards', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Operations & Queue Health' });

    const liveBadges = screen.getAllByText('Live Queue');
    expect(liveBadges.length).toBeGreaterThanOrEqual(3); // In Process, Ready for Pickup, Overdue Orders

    const kolkataBadges = screen.getAllByText('Asia/Kolkata');
    expect(kolkataBadges.length).toBe(2); // Due Today, Due Tomorrow
  });

  it('supports clicking interactive operational KPI cards to filter by status', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Operations & Queue Health' });

    // Click In Process card
    const inProcessCard = document.getElementById('kpi-in-process');
    expect(inProcessCard).toBeInTheDocument();
    expect(inProcessCard).toHaveAttribute('role', 'button');
    fireEvent.click(inProcessCard!);

    // Processing tab button should now have aria-pressed="true"
    const processingTab = screen.getByRole('button', { name: /^Processing/i });
    expect(processingTab).toBeInTheDocument();
    expect(processingTab).toHaveAttribute('aria-pressed', 'true');

    // Click Ready for Pickup card
    const readyCard = document.getElementById('kpi-ready-pickup');
    expect(readyCard).toBeInTheDocument();
    expect(readyCard).toHaveAttribute('role', 'button');
    fireEvent.click(readyCard!);
    const readyTab = screen.getByRole('button', { name: /^Ready/i });
    expect(readyTab).toBeInTheDocument();
    expect(readyTab).toHaveAttribute('aria-pressed', 'true');

    // Non-interactive cards like Refunds or Due Today should not have button role
    const refundsCard = document.getElementById('kpi-refunds');
    expect(refundsCard).not.toHaveAttribute('role', 'button');
  });

  it('renders correctly when comparison data is omitted by backend', async () => {
    const noComparisonData = {
      ...basePhase3Data,
      comparison: undefined,
    };
    fetchSpy.mockResolvedValueOnce(noComparisonData as any);

    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Financial Performance' });

    const collectionsCard = document.getElementById('kpi-collections-received');
    expect(within(collectionsCard!).getByText('Collections Received')).toBeInTheDocument();

    const ordersCard = document.getElementById('kpi-orders-created');
    expect(within(ordersCard!).getByText('Orders Created')).toBeInTheDocument();

    expect(screen.queryByText(/vs/i)).not.toBeInTheDocument();
  });
});

describe('DashboardPage - Phase 4: Trend Charts & Data Visualization', () => {
  const basePhase4Data = {
    period: { startDate: '2026-10-19', endDate: '2026-10-21' },
    overview: { totalOrders: 12, totalItems: 34, totalCustomers: 10 },
    orders: {
      received: 2,
      sorting: 1,
      processing: 3,
      drying: 1,
      ironing: 2,
      qualityCheck: 1,
      packed: 1,
      ready: 3,
      outForDelivery: 1,
      delivered: 5,
      cancelled: 0,
      overdue: 1,
      dueToday: 4,
      dueTomorrow: 2,
    },
    financial: {
      totalOrderValue: 15400,
      amountPaid: 12100,
      amountDue: 3300,
      paidOrders: 8,
      partialOrders: 3,
      pendingOrders: 1,
      bookedOrderValue: 15400,
      collections: 12100,
      refunds: 600,
      netCollections: 11500,
      outstandingBalance: 3300,
    },
    delivery: {
      scheduled: 1,
      assigned: 2,
      inTransit: 1,
      completed: 4,
      failed: 0,
    },
    customers: {
      total: 85,
      newInPeriod: 2,
    },
    readyOrders: [],
    recentOrders: [],
    recentActivity: [],
    trends: {
      interval: 'daily' as const,
      points: [
        {
          date: '2026-10-19',
          bookedOrderValue: 4500,
          orderCount: 4,
          collections: 3200,
          refunds: 0,
          netCollections: 3200,
        },
        {
          date: '2026-10-20',
          bookedOrderValue: 6200,
          orderCount: 5,
          collections: 4100,
          refunds: 200,
          netCollections: 3900,
        },
        {
          date: '2026-10-21',
          bookedOrderValue: 4700,
          orderCount: 3,
          collections: 4800,
          refunds: 400,
          netCollections: 4400,
        },
      ],
    },
    serviceBreakdown: [
      {
        serviceName: 'Dry Clean Suit',
        serviceCategory: 'DRY_CLEANING',
        itemCount: 8,
        totalAmount: 4800,
      },
      {
        serviceName: 'Wash & Fold Premium',
        serviceCategory: 'WASH_AND_FOLD',
        itemCount: 14,
        totalAmount: 2800,
      },
      {
        serviceName: 'Steam Press Silk Saree',
        serviceCategory: 'STEAM_PRESS',
        itemCount: 6,
        totalAmount: 1800,
      },
    ],
    categoryBreakdown: [
      {
        category: 'DRY_CLEANING',
        itemCount: 8,
        totalAmount: 4800,
      },
      {
        category: 'WASH_AND_FOLD',
        itemCount: 14,
        totalAmount: 2800,
      },
      {
        category: 'STEAM_PRESS',
        itemCount: 6,
        totalAmount: 1800,
      },
    ],
  };

  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi
      .spyOn(dashboardApi, 'fetchDashboardSummary')
      .mockResolvedValue(basePhase4Data as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Trends & Performance section with charts below KPI sections', async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByRole('heading', { name: 'Trends & Performance' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Performance Trends')).toBeInTheDocument();
    expect(screen.getByText('Service & Category Breakdown')).toBeInTheDocument();
    expect(screen.getByText('daily')).toBeInTheDocument();
  });

  it('displays accurate collection, booked value, and order activity trends in chart and accessible table', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Trends & Performance' });

    const trendCard = document.getElementById('dashboard-trends-card')!;
    expect(trendCard).toBeInTheDocument();

    // Legends present within chart card
    expect(trendCard.querySelector('#legend-collections')).toHaveTextContent(
      'Collections Received',
    );
    expect(trendCard.querySelector('#legend-net-collections')).toHaveTextContent('Net Collections');
    expect(trendCard.querySelector('#legend-refunds')).toHaveTextContent('Refunds');
    expect(trendCard.querySelector('#legend-booked-value')).toHaveTextContent('Order Value Booked');
    expect(trendCard.querySelector('#legend-order-count')).toHaveTextContent('Orders Created');

    // Verify screen reader table has backend trend points
    const trendTable = within(trendCard).getByRole('table', { name: /Daily Performance Trends/i });
    expect(trendTable).toBeInTheDocument();
    expect(within(trendTable).getByText('2026-10-19')).toBeInTheDocument();
    expect(within(trendTable).getByText('2026-10-20')).toBeInTheDocument();
    expect(within(trendTable).getByText('2026-10-21')).toBeInTheDocument();
  });

  it('allows switching between trend series (Overview, Collections, Booked Value, Order Volume)', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Trends & Performance' });

    const trendCard = document.getElementById('dashboard-trends-card')!;
    expect(trendCard).toBeInTheDocument();

    const collectionsBtn = within(trendCard).getByRole('button', { name: 'Collections' });
    const bookedBtn = within(trendCard).getByRole('button', { name: 'Booked Value' });
    const ordersBtn = within(trendCard).getByRole('button', { name: 'Order Volume' });

    // Switch to Collections
    fireEvent.click(collectionsBtn);
    expect(collectionsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(trendCard.querySelector('#legend-collections')).toBeInTheDocument();
    expect(trendCard.querySelector('#legend-booked-value')).not.toBeInTheDocument();

    // Switch to Booked Value
    fireEvent.click(bookedBtn);
    expect(bookedBtn).toHaveAttribute('aria-pressed', 'true');
    expect(trendCard.querySelector('#legend-booked-value')).toBeInTheDocument();
    expect(trendCard.querySelector('#legend-collections')).not.toBeInTheDocument();

    // Switch to Order Volume
    fireEvent.click(ordersBtn);
    expect(ordersBtn).toHaveAttribute('aria-pressed', 'true');
    expect(trendCard.querySelector('#legend-order-count')).toBeInTheDocument();
  });

  it('gracefully handles empty and all-zero trend datasets', async () => {
    const emptyTrendsData = {
      ...basePhase4Data,
      trends: {
        interval: 'daily' as const,
        points: [],
      },
    };
    fetchSpy.mockResolvedValueOnce(emptyTrendsData as any);

    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Trends & Performance' });
    expect(screen.getByText('No trend data available')).toBeInTheDocument();
  });

  it('gracefully handles all-zero trend points with helpful zero message', async () => {
    const zeroTrendsData = {
      ...basePhase4Data,
      trends: {
        interval: 'daily' as const,
        points: [
          {
            date: '2026-10-21',
            bookedOrderValue: 0,
            orderCount: 0,
            collections: 0,
            refunds: 0,
            netCollections: 0,
          },
        ],
      },
    };
    fetchSpy.mockResolvedValueOnce(zeroTrendsData as any);

    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Trends & Performance' });
    expect(screen.getByText('Zero activity in this period')).toBeInTheDocument();
  });

  it('renders Service & Category Breakdown and supports dimension and metric toggles', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Trends & Performance' });

    const breakdownCard = document.getElementById('dashboard-breakdown-card')!;
    expect(breakdownCard).toBeInTheDocument();

    // Defaults to Categories & Value
    const categoriesBtn = within(breakdownCard).getByRole('button', { name: 'Categories' });
    const servicesBtn = within(breakdownCard).getByRole('button', { name: 'Services' });
    const valueBtn = within(breakdownCard).getByRole('button', { name: 'Value (₹)' });
    const itemsBtn = within(breakdownCard).getByRole('button', { name: 'Items (Qty)' });

    expect(categoriesBtn).toHaveAttribute('aria-pressed', 'true');
    expect(valueBtn).toHaveAttribute('aria-pressed', 'true');

    // Category names and values present in breakdown list
    const breakdownList = within(breakdownCard).getByRole('list', { name: 'Breakdown Items' });
    expect(within(breakdownList).getByText('DRY_CLEANING')).toBeInTheDocument();
    expect(within(breakdownList).getByText('₹4,800')).toBeInTheDocument();
    expect(within(breakdownList).getByText('WASH_AND_FOLD')).toBeInTheDocument();
    expect(within(breakdownList).getByText('₹2,800')).toBeInTheDocument();
    expect(within(breakdownList).getByText('STEAM_PRESS')).toBeInTheDocument();
    expect(within(breakdownList).getByText('₹1,800')).toBeInTheDocument();

    // Explicit footnote clarifying booked garment line items, not cash collections
    expect(within(breakdownCard).getByText(/Line item amounts reflect/i)).toBeInTheDocument();
    expect(within(breakdownCard).getByText(/booked garment value/i)).toBeInTheDocument();

    // Toggle to Services dimension
    fireEvent.click(servicesBtn);
    expect(servicesBtn).toHaveAttribute('aria-pressed', 'true');
    expect(within(breakdownList).getByText('Dry Clean Suit')).toBeInTheDocument();
    expect(within(breakdownList).getByText('Wash & Fold Premium')).toBeInTheDocument();

    // Toggle to Items metric
    fireEvent.click(itemsBtn);
    expect(itemsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(within(breakdownList).getByText('14 pcs')).toBeInTheDocument();
    expect(within(breakdownList).getByText('8 pcs')).toBeInTheDocument();
    expect(within(breakdownList).getByText('6 pcs')).toBeInTheDocument();
  });

  it('handles empty or omitted service/category breakdowns gracefully', async () => {
    const noBreakdownData = {
      ...basePhase4Data,
      serviceBreakdown: [],
      categoryBreakdown: [],
    };
    fetchSpy.mockResolvedValueOnce(noBreakdownData as any);

    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Trends & Performance' });
    expect(screen.getByText('No breakdown data available')).toBeInTheDocument();
  });

  it('refreshes trend charts when the date filter changes', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Trends & Performance' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const weekBtn = screen.getByRole('button', { name: 'This Week' });
    fireEvent.click(weekBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});

describe('DashboardPage - Phase 5: Action Center, Operational Queues & Recent Activity', () => {
  const basePhase5Data = {
    period: { startDate: '2026-10-19', endDate: '2026-10-21' },
    overview: { totalOrders: 12, totalItems: 34, totalCustomers: 10 },
    orders: {
      received: 2,
      sorting: 1,
      processing: 3,
      drying: 1,
      ironing: 2,
      qualityCheck: 1,
      packed: 1,
      ready: 3,
      outForDelivery: 1,
      delivered: 5,
      cancelled: 0,
      overdue: 1,
      dueToday: 1,
      dueTomorrow: 0,
    },
    financial: {
      totalOrderValue: 15400,
      amountPaid: 12100,
      amountDue: 1600,
      paidOrders: 8,
      partialOrders: 3,
      pendingOrders: 1,
      bookedOrderValue: 15400,
      collections: 12100,
      refunds: 600,
      netCollections: 11500,
      outstandingBalance: 1600,
    },
    delivery: {
      scheduled: 1,
      assigned: 2,
      inTransit: 1,
      completed: 4,
      failed: 0,
    },
    customers: {
      total: 85,
      newInPeriod: 2,
    },
    readyOrders: [
      {
        id: 'ord-ready-1',
        orderNumber: 'ORD-2026-0091',
        customerName: 'Anil Kumar',
        customerPhone: '+91 98111 00001',
        totalAmount: 1400,
        amountPaid: 1400,
        amountDue: 0,
        readyItems: [{ garmentName: 'Silk Kurta', quantity: 2 }],
        remainingItems: [],
      },
    ],
    recentOrders: [],
    actionQueues: {
      overdue: {
        count: 1,
        items: [
          {
            id: 'ord-overdue-1',
            orderNumber: 'ORD-2026-0080',
            customerName: 'Vikas Sharma',
            customerPhone: '+91 98222 11111',
            totalAmount: 1200,
            amountPaid: 0,
            amountDue: 1200,
            status: 'PROCESSING',
            effectiveDueDate: '2026-10-18T10:00:00.000Z',
            orderDate: '2026-10-15T09:00:00.000Z',
            itemCount: 3,
          },
        ],
      },
      dueToday: {
        count: 1,
        items: [
          {
            id: 'ord-today-1',
            orderNumber: 'ORD-2026-0085',
            customerName: 'Neha Verma',
            customerPhone: '+91 98333 22222',
            totalAmount: 800,
            amountPaid: 400,
            amountDue: 400,
            status: 'PROCESSING',
            effectiveDueDate: '2026-10-21T14:00:00.000Z',
            orderDate: '2026-10-19T10:00:00.000Z',
            itemCount: 2,
          },
        ],
      },
      dueTomorrow: {
        count: 0,
        items: [],
      },
      readyForPickup: {
        count: 1,
        items: [
          {
            id: 'ord-ready-1',
            orderNumber: 'ORD-2026-0091',
            customerName: 'Anil Kumar',
            customerPhone: '+91 98111 00001',
            totalAmount: 1400,
            amountPaid: 1400,
            amountDue: 0,
            status: 'READY',
            effectiveDueDate: '2026-10-21T18:00:00.000Z',
            orderDate: '2026-10-19T11:00:00.000Z',
            itemCount: 2,
          },
        ],
      },
      pendingPayment: {
        count: 2,
        totalAmountDue: 1600,
        items: [
          {
            id: 'ord-overdue-1',
            orderNumber: 'ORD-2026-0080',
            customerName: 'Vikas Sharma',
            customerPhone: '+91 98222 11111',
            totalAmount: 1200,
            amountPaid: 0,
            amountDue: 1200,
            status: 'PROCESSING',
            effectiveDueDate: '2026-10-18T10:00:00.000Z',
            orderDate: '2026-10-15T09:00:00.000Z',
            itemCount: 3,
          },
          {
            id: 'ord-today-1',
            orderNumber: 'ORD-2026-0085',
            customerName: 'Neha Verma',
            customerPhone: '+91 98333 22222',
            totalAmount: 800,
            amountPaid: 400,
            amountDue: 400,
            status: 'PROCESSING',
            effectiveDueDate: '2026-10-21T14:00:00.000Z',
            orderDate: '2026-10-19T10:00:00.000Z',
            itemCount: 2,
          },
        ],
      },
    },
    recentActivity: [
      {
        id: 'act-1',
        eventType: 'ORDER_READY',
        orderId: 'ord-ready-1',
        orderNumber: 'ORD-2026-0091',
        message: 'Order is ready',
        createdAt: '2026-10-21T10:00:00.000Z',
      },
      {
        id: 'act-2',
        eventType: 'PAYMENT_RECEIVED',
        orderId: 'ord-ready-1',
        orderNumber: 'ORD-2026-0091',
        message: 'Payment received',
        createdAt: '2026-10-21T10:15:00.000Z',
      },
    ],
  };

  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi
      .spyOn(dashboardApi, 'fetchDashboardSummary')
      .mockResolvedValue(basePhase5Data as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Action Center with all 5 operational queue tabs and counts', async () => {
    render(<DashboardPage />);

    expect(await screen.findByRole('heading', { name: 'Action Center' })).toBeInTheDocument();

    const actionCenter = document.getElementById('dashboard-action-center')!;
    expect(actionCenter).toBeInTheDocument();

    // Verify all 5 tabs exist with correct counts
    const overdueTab = within(actionCenter).getByRole('tab', { name: /Overdue/i });
    expect(overdueTab).toBeInTheDocument();
    expect(within(overdueTab).getByText('1')).toBeInTheDocument();

    const dueTodayTab = within(actionCenter).getByRole('tab', { name: /Due Today/i });
    expect(dueTodayTab).toBeInTheDocument();
    expect(within(dueTodayTab).getByText('1')).toBeInTheDocument();

    const dueTomorrowTab = within(actionCenter).getByRole('tab', { name: /Due Tomorrow/i });
    expect(dueTomorrowTab).toBeInTheDocument();
    expect(within(dueTomorrowTab).getByText('0')).toBeInTheDocument();

    const readyTab = within(actionCenter).getByRole('tab', { name: /Ready for Pickup/i });
    expect(readyTab).toBeInTheDocument();
    expect(within(readyTab).getByText('1')).toBeInTheDocument();

    const pendingPaymentTab = within(actionCenter).getByRole('tab', { name: /Pending Payment/i });
    expect(pendingPaymentTab).toBeInTheDocument();
    expect(within(pendingPaymentTab).getByText('2')).toBeInTheDocument();
  });

  it('supports switching between operational queues and shows correct order details', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Action Center' });
    const actionCenter = document.getElementById('dashboard-action-center')!;

    // 1. Default active queue is Overdue: shows Vikas Sharma (#ORD-2026-0080)
    expect(within(actionCenter).getByText('#ORD-2026-0080')).toBeInTheDocument();
    expect(within(actionCenter).getByText('Vikas Sharma')).toBeInTheDocument();
    expect(within(actionCenter).getByText('Due: ₹1,200')).toBeInTheDocument();
    expect(within(actionCenter).getByText(/Past effective due date/i)).toBeInTheDocument();

    // 2. Switch to Due Today: shows Neha Verma (#ORD-2026-0085)
    const dueTodayTab = within(actionCenter).getByRole('tab', { name: /Due Today/i });
    fireEvent.click(dueTodayTab);
    expect(dueTodayTab).toHaveAttribute('aria-selected', 'true');
    expect(within(actionCenter).getByText('#ORD-2026-0085')).toBeInTheDocument();
    expect(within(actionCenter).getByText('Neha Verma')).toBeInTheDocument();
    expect(within(actionCenter).getByText('Due: ₹400')).toBeInTheDocument();

    // 3. Switch to Due Tomorrow: shows meaningful empty state (0 items)
    const dueTomorrowTab = within(actionCenter).getByRole('tab', { name: /Due Tomorrow/i });
    fireEvent.click(dueTomorrowTab);
    expect(dueTomorrowTab).toHaveAttribute('aria-selected', 'true');
    expect(within(actionCenter).getByText('📅 No Orders Due Tomorrow')).toBeInTheDocument();

    // 4. Switch to Ready for Pickup: shows Anil Kumar with ready garments preview
    const readyTab = within(actionCenter).getByRole('tab', { name: /Ready for Pickup/i });
    fireEvent.click(readyTab);
    expect(readyTab).toHaveAttribute('aria-selected', 'true');
    expect(within(actionCenter).getByText('#ORD-2026-0091')).toBeInTheDocument();
    expect(within(actionCenter).getByText('Anil Kumar')).toBeInTheDocument();
    expect(within(actionCenter).getByText('✓ Paid in Full')).toBeInTheDocument();
    expect(within(actionCenter).getByText(/Silk Kurta ×2/i)).toBeInTheDocument();

    // 5. Switch to Pending Payment: shows both unpaid orders
    const pendingPaymentTab = within(actionCenter).getByRole('tab', { name: /Pending Payment/i });
    fireEvent.click(pendingPaymentTab);
    expect(pendingPaymentTab).toHaveAttribute('aria-selected', 'true');
    expect(within(actionCenter).getByText('#ORD-2026-0080')).toBeInTheDocument();
    expect(within(actionCenter).getByText('#ORD-2026-0085')).toBeInTheDocument();
  });

  it('navigates to order detail page when Open Order button is clicked', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Action Center' });
    const actionCenter = document.getElementById('dashboard-action-center')!;

    // In Overdue queue, click Open Order for #ORD-2026-0080
    const openOrderBtn = within(actionCenter).getByRole('button', {
      name: /Open order #ORD-2026-0080/i,
    });
    expect(openOrderBtn).toBeInTheDocument();
    fireEvent.click(openOrderBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/orders/ord-overdue-1');
  });

  it('provides click-to-call links for customer phone numbers', async () => {
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Action Center' });
    const actionCenter = document.getElementById('dashboard-action-center')!;

    const phoneLink = within(actionCenter).getByRole('link', {
      name: /Call Vikas Sharma at \+91 98222 11111/i,
    });
    expect(phoneLink).toBeInTheDocument();
    expect(phoneLink).toHaveAttribute('href', 'tel:+91 98222 11111');
  });

  it('renders Recent Activity with clickable order links and formatted timestamps', async () => {
    render(<DashboardPage />);

    expect(await screen.findByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();

    const activityCard = document.getElementById('recent-activity-card')!;
    expect(activityCard).toBeInTheDocument();

    // Verifies events
    expect(within(activityCard).getByText('Order is ready')).toBeInTheDocument();
    expect(within(activityCard).getByText('Payment received')).toBeInTheDocument();

    // Clicking an activity event with an order link navigates to the order
    const readyActivity = within(activityCard).getByLabelText(
      /Order is ready for order #ORD-2026-0091/i,
    );
    expect(readyActivity).toBeInTheDocument();
    fireEvent.click(readyActivity);

    expect(mockNavigate).toHaveBeenCalledWith('/orders/ord-ready-1');
  });

  it('renders a meaningful empty state when Recent Activity is empty', async () => {
    const noActivityData = {
      ...basePhase5Data,
      recentActivity: [],
    };
    fetchSpy.mockResolvedValueOnce(noActivityData as any);

    render(<DashboardPage />);

    expect(await screen.findByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();

    const emptyCard = document.getElementById('recent-activity-empty');
    expect(emptyCard).toBeInTheDocument();
    expect(within(emptyCard!).getByText('No recent activity recorded')).toBeInTheDocument();
  });
});
