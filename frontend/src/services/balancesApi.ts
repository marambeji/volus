import { apiFetch } from './apiClient';
import type { PaginatedResponse } from './apiClient';

export interface BackendLeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType?: {
    key: string;
    label: string;
  };
  leavePolicyRuleId: string | null;
  year: number;
  availableBalance: number;
  usedYtd: number;
  pending: number;
  carriedOver: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackendLedgerEntry {
  id: string;
  balanceId: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType?: {
    key: string;
    label: string;
  };
  transactionType: string;
  transactionDate: string;
  signedAmount: number;
  resultingBalance: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  idempotencyKey: string | null;
  requestFingerprint: string | null;
  performedByEmployeeId: string | null;
  createdAt: string;
}

export async function getBalances(
  query?: { employeeId?: string; leaveTypeId?: string; year?: number; limit?: number },
  signal?: AbortSignal
): Promise<BackendLeaveBalance[]> {
  let url = '/leave-balances?limit=' + (query?.limit ?? 500);
  if (query?.employeeId) url += '&employeeId=' + encodeURIComponent(query.employeeId);
  if (query?.leaveTypeId) url += '&leaveTypeId=' + encodeURIComponent(query.leaveTypeId);
  if (query?.year) url += '&year=' + query.year;
  const res = await apiFetch<PaginatedResponse<BackendLeaveBalance>>(url, { signal });
  return res.data;
}

export async function getEmployeeBalances(
  employeeId: string,
  year?: number,
  signal?: AbortSignal
): Promise<BackendLeaveBalance[]> {
  let url = `/leave-balances/employee/${employeeId}`;
  if (year) url += `?year=${year}`;
  return apiFetch<BackendLeaveBalance[]>(url, { signal });
}

export async function adjustBalance(payload: {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  amount: number;
  reason: string;
  idempotencyKey?: string;
}): Promise<BackendLedgerEntry> {
  return apiFetch<BackendLedgerEntry>('/leave-balances/adjust', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// GET /leave-balances/ledger shapes rows into the same clean DTO as
// /leave-ledger/history (see AccrualHistoryRow below) — it does not return
// the raw LeaveLedgerEntry fields (no `transactionDate`/`leaveType`/`reason`/
// `resultingBalance`; use `createdAt`/`leaveTypeName`/`description`/`balanceAfter`).
export async function getLedgerEntries(
  query?: {
    employeeId?: string;
    leaveTypeId?: string;
    transactionType?: string;
    year?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  },
  signal?: AbortSignal
): Promise<AccrualHistoryRow[]> {
  let url = '/leave-balances/ledger?limit=' + (query?.limit ?? 500);
  if (query?.employeeId) url += '&employeeId=' + encodeURIComponent(query.employeeId);
  if (query?.leaveTypeId) url += '&leaveTypeId=' + encodeURIComponent(query.leaveTypeId);
  if (query?.transactionType) url += '&transactionType=' + encodeURIComponent(query.transactionType);
  if (query?.year) url += '&year=' + query.year;
  if (query?.dateFrom) url += '&dateFrom=' + encodeURIComponent(query.dateFrom);
  if (query?.dateTo) url += '&dateTo=' + encodeURIComponent(query.dateTo);
  const res = await apiFetch<PaginatedResponse<AccrualHistoryRow>>(url, { signal });
  return res.data;
}

// ── Accrual History DTO ─────────────────────────────────────────────────────

export interface AccrualHistoryRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  email: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  transactionType: string;
  description: string;
  signedAmount: number;
  usedDays: number;
  earnedDays: number;
  balanceAfter: number;
  createdAt: string;
  createdBy: string;
}

export interface LedgerHistoryQuery {
  search?: string;
  employeeId?: string;
  leaveTypeId?: string;
  transactionType?: string;
  year?: number;
  page?: number;
  limit?: number;
}

export async function getLedgerHistory(
  query?: LedgerHistoryQuery,
  signal?: AbortSignal
): Promise<PaginatedResponse<AccrualHistoryRow>> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  if (query?.leaveTypeId) params.set('leaveTypeId', query.leaveTypeId);
  if (query?.transactionType) params.set('transactionType', query.transactionType);
  if (query?.year) params.set('year', String(query.year));
  params.set('page', String(query?.page ?? 1));
  params.set('limit', String(query?.limit ?? 20));

  return apiFetch<PaginatedResponse<AccrualHistoryRow>>(
    `/leave-ledger/history?${params.toString()}`,
    { signal }
  );
}

