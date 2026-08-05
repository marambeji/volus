import { apiFetch } from './apiClient';

export interface ReportsQuery {
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  managerId?: string;
  department?: string;
  country?: string;
  leaveTypeId?: string;
  status?: string;
  year?: string;
}

export interface ReportRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  country: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: string;
  createdAt: string;
}

export interface ReportBalanceRow {
  employeeId: string;
  employeeName: string;
  department: string;
  country: string | null;
  balances: Record<string, { entitlement: number; used: number; available: number }>;
  totalAvailable: number;
}

export interface ReportOverlapCluster {
  startDate: string;
  endDate: string;
  requests: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface ReportOverlaps {
  clusters: ReportOverlapCluster[];
  dailyCounts: Array<{ date: string; count: number }>;
  peakConcurrent: number;
  totalOverlapDays: number;
}

function toQueryString(query: ReportsQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getRequestsReport(
  query: ReportsQuery = {},
  signal?: AbortSignal
): Promise<ReportRequestRow[]> {
  return apiFetch<ReportRequestRow[]>(`/reports/requests${toQueryString(query)}`, { signal });
}

export async function getBalancesReport(
  query: ReportsQuery = {},
  signal?: AbortSignal
): Promise<ReportBalanceRow[]> {
  return apiFetch<ReportBalanceRow[]>(`/reports/balances${toQueryString(query)}`, { signal });
}

export async function getOverlapsReport(
  query: ReportsQuery = {},
  signal?: AbortSignal
): Promise<ReportOverlaps> {
  return apiFetch<ReportOverlaps>(`/reports/overlaps${toQueryString(query)}`, { signal });
}
