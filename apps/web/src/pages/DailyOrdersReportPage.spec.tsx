import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DailyOrdersReportPage } from './DailyOrdersReportPage';
import { Role } from '@growfast/shared-types';
import * as reportApi from '../services/report.api';

let mockEmployee = {
  id: 'emp-owner-001',
  name: 'Prathamesh Bhagwat',
  role: Role.OWNER,
  storeId: 'store-pune-001',
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-jwt-token',
    user: { email: 'owner@growfast.com' },
    employee: mockEmployee,
    logout: vi.fn(),
  }),
}));

const mockReportData = {
  data: [
    {
      id: 'ord-101',
      orderNumber: 'T12980',
      customerId: 'cust-1',
      customerCode: 'Cust1856515',
      customerName: 'sagar patil',
      customerAddress: 'charoli',
      customerPhone: '9881636771',
      orderDate: '2026-10-19T09:41:00.000Z',
      formattedOrderDate: '19 Oct 2026, 09:41',
      dueDate: '2026-10-25T18:00:00.000Z',
      formattedDueDate: '25 Oct 2026',
      pieces: 3,
      weightKg: null,
      grossAmount: 150,
      discount: 0,
      netAmount: 150,
      advance: 0,
      balance: 150,
      status: 'RECEIVED',
      orderType: 'LAUNDRY_DRY_CLEANING',
      employeeName: 'Store Staff',
    },
    {
      id: 'ord-102',
      orderNumber: 'T12981',
      customerId: 'cust-2',
      customerCode: 'Cust464567',
      customerName: 'Pankaj',
      customerAddress: 'near ambar hotel godown chowk bhosari',
      customerPhone: '9356905139',
      orderDate: '2026-10-19T09:49:00.000Z',
      formattedOrderDate: '19 Oct 2026, 09:49',
      dueDate: '2026-10-25T18:00:00.000Z',
      formattedDueDate: '25 Oct 2026',
      pieces: 31,
      weightKg: 8.4,
      grossAmount: 1092,
      discount: 0,
      netAmount: 1092,
      advance: 0,
      balance: 1092,
      status: 'PROCESSING',
      orderType: 'LAUNDRY_DRY_CLEANING',
      employeeName: 'Store Staff',
    },
    {
      id: 'ord-103',
      orderNumber: 'T12986',
      customerId: 'cust-3',
      customerCode: 'Cust2223648',
      customerName: 'Anup Nair',
      customerAddress: 'C1203 Tanish O2 Wadmukhwadi road',
      customerPhone: '7028922646',
      orderDate: '2026-10-19T10:45:00.000Z',
      formattedOrderDate: '19 Oct 2026, 10:45',
      dueDate: '2026-10-26T18:00:00.000Z',
      formattedDueDate: '26 Oct 2026',
      pieces: 10,
      weightKg: null,
      grossAmount: 1120,
      discount: 56,
      netAmount: 1064,
      advance: 0,
      balance: 1064,
      status: 'RECEIVED',
      orderType: 'LAUNDRY_DRY_CLEANING',
      employeeName: 'Store Staff',
    },
  ],
  total: 3,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  summary: {
    totalOrders: 3,
    totalPieces: 44,
    totalWeightKg: 8.4,
    totalGrossAmount: 2362,
    totalDiscount: 56,
    totalNetAmount: 2306,
    totalAdvance: 0,
    totalBalance: 2306,
  },
};

describe('DailyOrdersReportPage', () => {
  let fetchReportSpy: any;
  let exportExcelSpy: any;
  let fetchEmployeesSpy: any;
  let searchCustomersSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmployee = {
      id: 'emp-owner-001',
      name: 'Prathamesh Bhagwat',
      role: Role.OWNER,
      storeId: 'store-pune-001',
    };

    fetchReportSpy = vi.spyOn(reportApi, 'fetchDailyOrdersReport').mockResolvedValue(mockReportData as any);
    exportExcelSpy = vi.spyOn(reportApi, 'exportDailyOrdersToExcel').mockImplementation(() => {});
    fetchEmployeesSpy = vi.spyOn(reportApi, 'fetchEmployeesForFilter').mockResolvedValue([
      { id: 'emp-1', name: 'Rahul Joshi', role: 'COUNTER' },
      { id: 'emp-2', name: 'Prathamesh Bhagwat', role: 'OWNER' },
    ]);
    searchCustomersSpy = vi.spyOn(reportApi, 'searchCustomersForFilter').mockResolvedValue([
      { id: 'cust-1', name: 'sagar patil', customerCode: 'Cust1856515', phone: '9881636771' },
      { id: 'cust-2', name: 'Pankaj', customerCode: 'Cust464567', phone: '9356905139' },
    ]);
  });

  it('1. Renders Daily Orders title, controls, and table data', async () => {
    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Daily Orders' })).toBeInTheDocument();
    expect(screen.getByText('Download historical report')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export to excel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    expect(screen.getByText('Expand')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('T12980')).toBeInTheDocument();
      expect(screen.getByText('sagar patil')).toBeInTheDocument();
      expect(screen.getByText('Pankaj')).toBeInTheDocument();
      expect(screen.getByText('Anup Nair')).toBeInTheDocument();
      expect(screen.getAllByText('1064').length).toBeGreaterThanOrEqual(1); // Net Amount & Balance for Anup Nair
    });
  });

  it('2. Shows empty state when no orders are found', async () => {
    fetchReportSpy.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      summary: {
        totalOrders: 0,
        totalPieces: 0,
        totalWeightKg: 0,
        totalGrossAmount: 0,
        totalDiscount: 0,
        totalNetAmount: 0,
        totalAdvance: 0,
        totalBalance: 0,
      },
    });

    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No Orders found')).toBeInTheDocument();
    });
  });

  it('3. Date Range Popover opens and allows selecting Yesterday & Today with UPDATE', async () => {
    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchReportSpy).toHaveBeenCalled());

    // Click Date range trigger
    const popoverTrigger = screen.getByRole('button', { name: /oct \d{1,2}, \d{4} - oct \d{1,2}, \d{4}|select date range/i });
    fireEvent.click(popoverTrigger);

    // Verify popover options
    expect(screen.getByRole('button', { name: /^Today$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Yesterday$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Yesterday & Today$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Custom Days$/i })).toBeInTheDocument();

    // Select Yesterday & Today
    const yesterdayTodayBtn = screen.getByRole('button', { name: /^Yesterday & Today$/i });
    fireEvent.click(yesterdayTodayBtn);

    // Click UPDATE
    const updateBtn = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(fetchReportSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('4. Date Range Popover Cancel does not apply pending changes', async () => {
    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchReportSpy).toHaveBeenCalledTimes(1));

    const popoverTrigger = screen.getByRole('button', { name: /oct \d{1,2}, \d{4} - oct \d{1,2}, \d{4}|select date range/i });
    fireEvent.click(popoverTrigger);

    // Select Yesterday
    const yesterdayBtn = screen.getByRole('button', { name: /^Yesterday$/i });
    fireEvent.click(yesterdayBtn);

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // Should NOT have made an extra fetch call
    expect(fetchReportSpy).toHaveBeenCalledTimes(1);
  });

  it('5. Filters modal opens, adjusts draft filters, and applies them on APPLY', async () => {
    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchReportSpy).toHaveBeenCalled());

    // Open filters modal
    const filtersBtn = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filtersBtn);

    expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Order Number')).toBeInTheDocument();

    // Type order number
    const orderNumInput = screen.getByPlaceholderText('Order Number');
    fireEvent.change(orderNumInput, { target: { value: 'T12986' } });

    // Click APPLY
    const applyBtn = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(fetchReportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: 'T12986',
        }),
      );
    });
  });

  it('6. Filters modal CLEAR resets all filters to default', async () => {
    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchReportSpy).toHaveBeenCalled());

    // Open modal and change a filter
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.change(screen.getByPlaceholderText('Order Number'), { target: { value: 'T12986' } });

    // Click CLEAR
    const clearBtn = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(fetchReportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: undefined,
        }),
      );
    });
  });

  it('7. EXPORT TO EXCEL button triggers export function', async () => {
    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('T12980')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export to excel/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportExcelSpy).toHaveBeenCalled();
    });
  });

  it('8. Expand switch toggles layout container width', async () => {
    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    const expandSwitch = screen.getByRole('switch');
    expect(expandSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(expandSwitch);
    expect(expandSwitch).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(expandSwitch);
    expect(expandSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('9. Denies access to unauthorized roles (COUNTER)', () => {
    mockEmployee = {
      id: 'emp-counter-001',
      name: 'Counter Staff',
      role: Role.COUNTER,
      storeId: 'store-pune-001',
    };

    render(
      <MemoryRouter>
        <DailyOrdersReportPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText(/Daily Orders reports are exclusively accessible to Store Owners and Store Managers/i)).toBeInTheDocument();
    expect(screen.queryByText('Order Date / Time')).not.toBeInTheDocument();
  });
});
