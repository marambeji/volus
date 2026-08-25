import { apiFetch } from './apiClient';

export interface ReminderSettings {
  id: string;
  enabled: boolean;
  delayHours: number;
  updatedAt: string;
}

export interface ReminderHistoryEntry {
  id: string;
  approvalInstanceId: string;
  requestId: string;
  approverId: string;
  approverEmail: string;
  sentAt: string;
  approver?: { fullName: string };
  request?: {
    employee?: { fullName: string };
    leaveType?: { label: string };
    startDate: string;
    endDate: string;
  };
}

export async function getReminderSettings(signal?: AbortSignal): Promise<ReminderSettings> {
  return apiFetch<ReminderSettings>('/reminders/settings', { signal });
}

export async function updateReminderSettings(dto: {
  enabled?: boolean;
  delayHours?: number;
}): Promise<ReminderSettings> {
  return apiFetch<ReminderSettings>('/reminders/settings', {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function getReminderHistory(
  limit = 50,
  signal?: AbortSignal
): Promise<ReminderHistoryEntry[]> {
  return apiFetch<ReminderHistoryEntry[]>(`/reminders/history?limit=${limit}`, { signal });
}

export async function runReminderCheckNow(): Promise<{ checked: number; sent: number }> {
  return apiFetch<{ checked: number; sent: number }>('/reminders/run', { method: 'POST' });
}
