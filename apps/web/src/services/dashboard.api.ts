import type { DashboardSummaryDTO } from '@growfast/shared-types';

const API_BASE = '/api/dashboard';

export async function fetchDashboardSummary(
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal,
  branchId?: string,
): Promise<DashboardSummaryDTO> {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  const queryString = params.toString();
  const url = `${API_BASE}/summary${queryString ? `?${queryString}` : ''}`;

  const token = localStorage.getItem('growfast_token');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const activeBranch = branchId || localStorage.getItem('growfast_active_branch_id');
  if (activeBranch) {
    headers['x-branch-id'] = activeBranch;
  }

  const res = await fetch(url, {
    headers,
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Dashboard request failed (${res.status})`);
  }

  return res.json();
}
