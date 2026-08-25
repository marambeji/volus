import { apiFetch } from './apiClient';

export interface AuditLogEntry {
  id: string;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  oldValues?: any;
  newValues?: any;
  changedFields?: string[] | null;
  reason?: string | null;
  description?: string | null;
}

export async function getGlobalAuditLogs(query?: {
  entityType?: string;
  actionType?: string;
}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (query?.entityType) params.set('entityType', query.entityType);
  if (query?.actionType) params.set('actionType', query.actionType);
  const qs = params.toString();
  return apiFetch<AuditLogEntry[]>(`/audit-logs/global${qs ? '?' + qs : ''}`);
}

export async function getMyNotifications(): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>('/audit-logs/my-notifications');
}
