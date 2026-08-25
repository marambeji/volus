import { apiFetch } from './apiClient';

export async function hrGetLeaveRequests(params?: any): Promise<any[]> {
  const query = new URLSearchParams(params).toString();
  return apiFetch<any[]>(`/leave-requests/hr?${query}`);
}

export async function hrApproveLeaveRequest(id: string): Promise<any> {
  return apiFetch<any>(`/leave-requests/hr/${id}/approve`, {
    method: 'PUT',
  });
}

export async function hrDeleteLeaveRequest(id: string, reason: string): Promise<any> {
  return apiFetch<any>(`/leave-requests/hr/${id}/delete`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
}

export async function hrRejectLeaveRequest(id: string, reason: string): Promise<any> {
  return apiFetch<any>(`/leave-requests/hr/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
}
