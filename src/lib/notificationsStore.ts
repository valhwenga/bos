/**
 * Notifications.
 *
 * These were written to localStorage — the sender's. `notify(colleague, …)`
 * filed the notification in your own browser, where the colleague could never
 * see it, and the bell in the header read that same local store filtered to
 * your own id. So assigning work notified nobody, and the only entries that
 * ever appeared were the ones you had somehow addressed to yourself.
 *
 * They are rows now, readable only by the person they are for, and delivered
 * over a realtime subscription so one arrives while you are on another screen
 * rather than on your next page load.
 */

import { supabase } from "./supabase";
import { createCache } from "./collectionCache";
import { getSession } from "./session";

export type NotificationType = "message" | "email" | "ticket";

export type AppNotification = {
  id: string;
  ts: string;
  userId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  description?: string;
  link?: string;
  read: boolean;
};

const COLUMNS = "id, recipient_id, actor_id, type, title, description, link, read_at, created_at";

type Row = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  description: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const toNotification = (row: Row): AppNotification => ({
  id: row.id,
  ts: row.created_at,
  userId: row.recipient_id,
  actorId: row.actor_id,
  type: row.type,
  title: row.title,
  description: row.description ?? undefined,
  link: row.link ?? undefined,
  read: row.read_at !== null,
});

/**
 * Only ever the signed-in person's own rows — row level security would filter
 * anything else, so asking for more would be a request that quietly returns
 * nothing.
 */
async function fetchMine(): Promise<AppNotification[]> {
  if (!getSession().profile?.id) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toNotification(row as Row));
}

export const notificationsCache = createCache<AppNotification>(fetchMine);

/**
 * A route the app will actually navigate to.
 *
 * The database refuses anything else, but a link that fails the check would
 * take the whole notification down with it — and the notification matters more
 * than the link. This drops a bad one instead.
 */
// The second character must not be a slash: "//host/x" is a protocol-relative
// URL, and it begins with "/" exactly as a real route does.
const IN_APP_PATH = /^\/(?:[A-Za-z0-9_:.~-][A-Za-z0-9/_:.~?&=%-]*)?$/;
const safeLink = (link?: string) => (link && IN_APP_PATH.test(link) ? link : undefined);

export const NotificationsStore = {
  list(): AppNotification[] {
    return notificationsCache.list();
  },
  load(): Promise<AppNotification[]> {
    return notificationsCache.ensureLoaded();
  },
  /**
   * Kept for the header, which asks for a specific person's notifications. The
   * server already answers with only your own, so this is a consistency check
   * rather than a filter that does work.
   */
  forUser(userId: string): AppNotification[] {
    return this.list().filter((n) => n.userId === userId);
  },
  unreadCount(userId: string): number {
    return this.forUser(userId).filter((n) => !n.read).length;
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    await notificationsCache.refresh();
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    await notificationsCache.refresh();
  },
};

/**
 * Sends a notification to somebody.
 *
 * Fire and forget by design — the work being notified about has already
 * happened, and failing to mention it must not undo it. Failures surface
 * through the global rejection reporter rather than vanishing.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  description?: string,
  link?: string,
): Promise<void> {
  if (!userId) return;
  const { error } = await supabase.from("notifications").insert({
    recipient_id: userId,
    type,
    title,
    description: description ?? null,
    link: safeLink(link) ?? null,
  });
  if (error) throw new Error(`Notification failed: ${error.message}`);
  // Your own rows are the only ones this cache holds, so notifying somebody
  // else changes nothing here; notifying yourself does.
  if (userId === getSession().profile?.id) void notificationsCache.refresh();
}

/**
 * Subscribes to notifications arriving for the signed-in person.
 *
 * Returns an unsubscribe function. The caller also refreshes on window focus:
 * a websocket that has quietly dropped would otherwise leave the bell frozen,
 * and the failure mode of a notification system is not noticing that it stopped.
 */
export function subscribeToNotifications(onArrive?: (n: AppNotification) => void): () => void {
  const me = getSession().profile?.id;
  if (!me) return () => undefined;

  // A unique topic per subscriber. Supabase returns the *existing* channel for
  // a repeated topic, so two components subscribing under one name meant the
  // second `.on()` was added after the first had already subscribed — which
  // throws, and took the whole app down through the error boundary. Both the
  // header and the desktop-notification effect subscribe, so that was every
  // page load.
  const channel = supabase
    .channel(`notifications:${me}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${me}`,
      },
      (payload) => {
        const row = payload.new as Row;
        void notificationsCache.refresh();
        onArrive?.(toNotification(row));
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
