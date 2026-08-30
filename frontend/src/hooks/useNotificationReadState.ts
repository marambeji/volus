import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'my_read_notification_ids';
const SYNC_EVENT = 'notif_read_ids_updated';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persist(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch {}
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/**
 * Shared read/unread state for notifications, backed by localStorage.
 * The bell dropdown (always mounted in Layout) and the full Notifications page
 * both use this, and stay in sync via a same-tab custom event — plain
 * localStorage writes don't fire the 'storage' event within the same tab.
 */
export function useNotificationReadState() {
  const [readIds, setReadIds] = useState<Set<string>>(load);

  useEffect(() => {
    const sync = () => setReadIds(load());
    window.addEventListener(SYNC_EVENT, sync);
    return () => window.removeEventListener(SYNC_EVENT, sync);
  }, []);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persist(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback((ids: string[]) => {
    const next = new Set(ids);
    setReadIds(next);
    persist(next);
  }, []);

  return { readIds, markRead, markAllRead };
}
