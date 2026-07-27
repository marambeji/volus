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
): Promise<BackendLedgerEntry[]> {
  let url = '/leave-balances/ledger?limit=' + (query?.limit ?? 500);
  if (query?.employeeId) url += '&employeeId=' + encodeURIComponent(query.employeeId);
  if (query?.leaveTypeId) url += '&leaveTypeId=' + encodeURIComponent(query.leaveTypeId);
  if (query?.transactionType) url += '&transactionType=' + encodeURIComponent(query.transactionType);
  if (query?.year) url += '&year=' + query.year;
  if (query?.dateFrom) url += '&dateFrom=' + encodeURIComponent(query.dateFrom);
  if (query?.dateTo) url += '&dateTo=' + encodeURIComponent(query.dateTo);
  const res = await apiFetch<PaginatedResponse<BackendLedgerEntry>>(url, { signal });
  return res.data;
}
