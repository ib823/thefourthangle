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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function getNotifications(): NotificationItem[] {
  return load();
}

export function getUnreadCount(): number {
  return load().filter(n => !n.read).length;
}

export function addNotification(item: Omit<NotificationItem, 'id' | 'read'>) {
  const items = load();
  // Deduplicate by issueId
  if (items.some(n => n.issueId === item.issueId && Date.now() - n.timestamp < 24 * 60 * 60 * 1000)) {
    return;
  }
  items.unshift({
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

export function clearAll() {
  save([]);
}
