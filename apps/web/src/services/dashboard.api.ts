import type { DashboardSummaryDTO } from '@growfast/shared-types';

const API_BASE = '/api/dashboard';

export async function fetchDashboardSummary(
  startDate?: string,
  endDate?: string,
): Promise<DashboardSummaryDTO> {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  const queryString = params.toString();
  const url = `${API_BASE}/summary${queryString ? `?${queryString}` : ''}`;

  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Dashboard request failed (${res.status})`);
  }

  return res.json();
}
