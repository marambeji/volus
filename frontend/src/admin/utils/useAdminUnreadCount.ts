import { useState, useEffect } from 'react';
import { getGlobalAuditLogs } from '../../services/auditLogsApi';

const LS_KEY = 'notif_read_ids';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

/**
 * Single source of truth for the admin "unread notifications" badge, shared by
 * the header bell and the sidebar link. Matches Notifications.tsx's own count
 * (unread = logs whose id isn't in notif_read_ids) so all three never drift.
 */
export function useAdminUnreadCount(): number {
  const [ids, setIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);

  useEffect(() => {
    getGlobalAuditLogs()
      .then((logs) => setIds(logs.map((l) => l.id)))
      .catch(() => setIds([]));

    const sync = () => setReadIds(loadReadIds());
    window.addEventListener('notif_read_updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('notif_read_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return ids.filter((id) => !readIds.has(id)).length;
}
