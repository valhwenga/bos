export type NotificationType = "message" | "email" | "ticket";
export type AppNotification = {
  id: string;
  ts: string; // ISO
  userId: string; // recipient user id
  type: NotificationType;
  title: string;
  description?: string;
  link?: string; // route to open
  read?: boolean;
};

const K = { notifs: "app.notifications" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const NotificationsStore = {
  list(): AppNotification[] { return r<AppNotification[]>(K.notifs, []); },
  forUser(userId: string) { return this.list().filter(n => n.userId === userId); },
  unreadCount(userId: string) { return this.forUser(userId).filter(n => !n.read).length; },
  append(n: AppNotification) { const all = this.list(); all.unshift(n); w(K.notifs, all.slice(0, 500)); try { window.dispatchEvent(new CustomEvent("app:notify", { detail: n })); } catch {} return n; },
  markAllRead(userId: string) { const all = this.list().map(n => n.userId===userId ? { ...n, read: true } : n); w(K.notifs, all); },
  markRead(id: string) { const all = this.list(); const i = all.findIndex(n => n.id===id); if (i>=0) { all[i] = { ...all[i], read: true }; w(K.notifs, all); } },
};

export function notify(userId: string, type: NotificationType, title: string, description?: string, link?: string) {
  const n: AppNotification = { id: `n_${Math.random().toString(36).slice(2,8)}`, ts: new Date().toISOString(), userId, type, title, description, link, read: false };
  return NotificationsStore.append(n);
}
