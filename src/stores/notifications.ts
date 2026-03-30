/**
 * Notification inbox store — keeps history of received push notifications
 * in localStorage so users can see what was notified even after dismissing.
 */

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  issueId: string;
  url: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'tfa-notifications';
const MAX_ITEMS = 50;

function load(): NotificationItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function save(items: NotificationItem[]) {
  const trimmed = items.slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // Quota exceeded — drop oldest half and retry
    try {
      const half = trimmed.slice(0, Math.floor(trimmed.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
    } catch {
      // Still fails — clear entirely
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }
}

export function getNotifications(): NotificationItem[] {
  return load();
}

export function getUnreadCount(): number {
  return load().filter(n => !n.read).length;
}

export function addNotification(item: Omit<NotificationItem, 'id' | 'read'>) {
  // Reject empty/invalid
  if (!item.issueId || !item.title) return;
  const items = load();
  // Deduplicate by issueId within 24h
  if (items.some(n => n.issueId === item.issueId && Date.now() - n.timestamp < 24 * 60 * 60 * 1000)) {
    return;
  }
  items.unshift({
    ...item,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    read: false,
  });
  save(items);
}

export function markAsRead(id: string) {
  const items = load();
  const item = items.find(n => n.id === id);
  if (item) {
    item.read = true;
    save(items);
  }
}

export function markAllAsRead() {
  const items = load();
  items.forEach(n => { n.read = true; });
  save(items);
}

export function removeNotification(id: string) {
  const items = load().filter(n => n.id !== id);
  save(items);
}

export function clearAll() {
  save([]);
}
