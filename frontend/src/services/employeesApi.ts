import { apiFetch } from './apiClient';
import type { PaginatedResponse } from './apiClient';

export interface BackendEmployee {
  id: string;
  employeeNumber: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  jobTitle: string;
  department: string;
  unit: string | null;
  managerId: string | null;
  countryId: string;
  country: string;
  countryCode: string;
  divisionId: string | null;
  division: string | null;
  approvalWorkflowId: string | null;
  approvalWorkflow: string | null;
  policyId: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN';
  workMode: 'ONSITE' | 'HYBRID' | 'REMOTE';
  role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  hireDate: string;
  gender: 'MALE' | 'FEMALE' | null;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export async function getEmployees(
  query?: { q?: string; status?: string; limit?: number; divisionId?: string; departmentId?: string },
  signal?: AbortSignal
): Promise<BackendEmployee[]> {
  let url = '/employees?limit=' + (query?.limit ?? 200);
  if (query?.q) {
    url += '&q=' + encodeURIComponent(query.q);
  }
  if (query?.status) {
    url += '&status=' + encodeURIComponent(query.status);
  }
  if (query?.divisionId) {
    url += '&divisionId=' + encodeURIComponent(query.divisionId);
  }
  if (query?.departmentId) {
    url += '&departmentId=' + encodeURIComponent(query.departmentId);
  }
  const res = await apiFetch<PaginatedResponse<BackendEmployee>>(url, { signal });
  return res.data;
}

export async function createEmployee(
  payload: Record<string, any>
): Promise<BackendEmployee> {
  return apiFetch<BackendEmployee>('/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEmployee(
  id: string,
  payload: Record<string, any>
): Promise<BackendEmployee> {
  return apiFetch<BackendEmployee>(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteEmployee(id: string): Promise<void> {
  return apiFetch<void>(`/employees/${id}`, {
    method: 'DELETE',
  });
}

export interface LeaveConfiguration {
  employeeId: string;
  policyId: string;
  effectiveDate: string;
  leaveTypes: Array<{
    leaveTypeId: string;
    code: string;
    name: string;
    trackingMode: 'AVAILABLE_BALANCE' | 'USAGE_YTD';
    availableBalance: number;
    usageYtd: number;
    allowsHalfDay: boolean;
    requiresNote: boolean;
    requiresDocument: boolean;
    requiresPositiveBalance: boolean;
    minRequestDays: number;
    maxRequestDays: number | null;
    maxConsecutiveDays: number | null;
    waitingPeriodDays: number;
    allowedCountries: string[] | null;
    eligible: boolean;
    ineligibilityReasons: string[];
  }>;
}

export async function getLeaveConfiguration(
  employeeId: string,
  signal?: AbortSignal
): Promise<LeaveConfiguration> {
  return apiFetch<LeaveConfiguration>(`/employees/${employeeId}/leave-configuration`, {
    signal,
  });
}

export async function getMyLeaveBalances(
  signal?: AbortSignal
): Promise<any> {
  return apiFetch<any>(`/employees/me/leave-balances`, { signal });
}

export async function submitLeaveRequest(
  payload: { leaveTypeId: string; startDate: string; endDate: string; durationDays: number; reason?: string }
): Promise<any> {
  return apiFetch<any>(`/leave-requests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getApprovalProgress(requestId: string, signal?: AbortSignal): Promise<any> {
  return apiFetch<any>(`/leave-requests/${requestId}/approval-progress`, { signal });
}

export async function getMyLeaveRequests(signal?: AbortSignal): Promise<any[]> {
  return apiFetch<any[]>(`/leave-requests/my-requests`, { signal });
}

export async function getDirectory(
  query?: { q?: string; department?: string; page?: number; limit?: number },
  signal?: AbortSignal
): Promise<any> {
  const searchParams = new URLSearchParams();
  if (query?.q) searchParams.set('q', query.q);
  if (query?.department && query.department !== 'All') searchParams.set('department', query.department);
  if (query?.page) searchParams.set('page', query.page.toString());
  if (query?.limit) searchParams.set('limit', query.limit.toString());
  
  return apiFetch<any>(`/employees/directory?${searchParams.toString()}`, { signal });
}

