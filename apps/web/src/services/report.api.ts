import type {
  DailyOrdersReportQueryDTO,
  DailyOrdersReportResponseDTO,
  DailyOrderReportRowDTO,
} from '@growfast/shared-types';

const API_BASE = '/api';

/**
 * Fetches the Daily Orders Report from the backend.
 */
export async function fetchDailyOrdersReport(
  query: DailyOrdersReportQueryDTO,
): Promise<DailyOrdersReportResponseDTO> {
  const params = new URLSearchParams();

  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);
  if (query.timezone) params.set('timezone', query.timezone);
  if (query.customerId) params.set('customerId', query.customerId);
  if (query.orderNumber) params.set('orderNumber', query.orderNumber);
  if (query.orderType) params.set('orderType', query.orderType);
  if (query.userId) params.set('userId', query.userId);
  if (query.hasDiscount) params.set('hasDiscount', query.hasDiscount);
  if (query.filterBy) params.set('filterBy', query.filterBy);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.export) params.set('export', 'true');

  const queryString = params.toString();
  const url = `${API_BASE}/reports/daily-orders${queryString ? `?${queryString}` : ''}`;

  const token = localStorage.getItem('growfast_token');
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Failed to fetch daily orders report (${res.status})`);
  }

  return res.json();
}

/**
 * Fetches store employees for the User filter dropdown.
 */
export async function fetchEmployeesForFilter(): Promise<
  Array<{ id: string; name: string; role: string }>
> {
  const token = localStorage.getItem('growfast_token');
  try {
    const res = await fetch(`${API_BASE}/employees?isActive=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return [];
    const body = await res.json();
    return body.data || [];
  } catch {
    return [];
  }
}

/**
 * Searches customers for the Customer filter dropdown.
 */
export async function searchCustomersForFilter(
  query: string,
): Promise<Array<{ id: string; name: string; customerCode?: string; phone: string }>> {
  const token = localStorage.getItem('growfast_token');
  try {
    const params = new URLSearchParams({ page: '1', pageSize: '10' });
    if (query?.trim()) params.set('query', query.trim());

    const res = await fetch(`${API_BASE}/customers/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return [];
    const body = await res.json();
    return body.data || [];
  } catch {
    return [];
  }
}

/**
 * Exports daily orders report rows to CSV formatted for Microsoft Excel with UTF-8 BOM.
 */
export function exportDailyOrdersToExcel(
  rows: DailyOrderReportRowDTO[],
  dateRangeLabel: string,
): void {
  const headers = [
    'Order Date / Time',
    'Order No.',
    'Customer Code',
    'Name',
    'Address',
    'Phone',
    'Due Date',
    'Pcs.',
    'Weight',
    'Gross Amount',
    'Discount',
    'Net Amount',
    'Advance',
    'Balance',
    'Status',
    'Payment Status',
    'Order Type',
    'Created By',
  ];

  const escapeCSV = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvRows = rows.map((r) =>
    [
      escapeCSV(r.formattedOrderDate),
      escapeCSV(r.orderNumber),
      escapeCSV(r.customerCode),
      escapeCSV(r.customerName),
      escapeCSV(r.customerAddress),
      escapeCSV(r.customerPhone),
      escapeCSV(r.formattedDueDate),
      escapeCSV(r.pieces),
      escapeCSV(r.weight != null ? r.weight : '-'),
      escapeCSV(r.grossAmount),
      escapeCSV(r.discount),
      escapeCSV(r.netAmount),
      escapeCSV(r.advance),
      escapeCSV(r.balance),
      escapeCSV(r.status),
      escapeCSV(r.paymentStatus),
      escapeCSV(r.orderTypeSummary || '-'),
      escapeCSV(r.createdByName || '-'),
    ].join(','),
  );

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens it with full UTF-8 character encoding support
  const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const safeLabel = dateRangeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Daily_Orders_${safeLabel}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
