/**
 * Messenger.
 *
 * Conversations and messages were localStorage, which for a chat is close to a
 * contradiction: sending a message wrote it to your own browser and nowhere
 * else, so the person you were talking to never received it, and you were the
 * only real participant in every conversation you had. Adding somebody to a
 * group added them to your copy of it.
 *
 * They are rows now, readable only by the people in the thread, and delivered
 * over a realtime subscription.
 */

import { supabase } from "./supabase";
import { createCache } from "./collectionCache";
import { getSession } from "./session";
import { notify } from "./notificationsStore";

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  /** A signed URL, resolved on demand. Files live in message-attachments. */
  url?: string;
};

export type ChatMessage = {
  id: string;
  convId: string;
  authorId: string | null;
  body: string;
  ts: string;
  attachments?: ChatAttachment[];
  replyToId?: string;
};

export type Conversation = {
  id: string;
  name?: string;
  isGroup: boolean;
  members: string[];
  createdAt: string;
  lastMessageAt?: string;
  /** Unread for the signed-in person, derived from their own high-water mark. */
  unread: number;
  /**
   * Each member's high-water mark, so a message can show whether everyone has
   * seen it. The old `readBy` array was only ever written in the sender's own
   * browser, so the double tick reflected nothing.
   */
  readAt: Record<string, string | null>;
  /**
   * Enough of the newest message to preview in the list. Carried on the
   * conversation because the list would otherwise have to load every thread's
   * messages to show one line of each.
   */
  lastMessage?: { authorId: string | null; body: string; hasAttachment: boolean };
};

const me = () => getSession().profile?.id;

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

async function fetchConversations(): Promise<Conversation[]> {
  const myId = me();
  if (!myId) return [];

  // Row level security already limits these to conversations the caller is in,
  // so this is the whole list rather than a filtered one.
  const [convResult, memberResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, name, is_group, created_at, last_message_at")
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase.from("conversation_members").select("conversation_id, profile_id, last_read_at"),
  ]);
  if (convResult.error) throw new Error(convResult.error.message);
  if (memberResult.error) throw new Error(memberResult.error.message);

  type MemberRow = { conversation_id: string; profile_id: string; last_read_at: string | null };
  const members = new Map<string, string[]>();
  const readAt = new Map<string, Record<string, string | null>>();
  const myLastRead = new Map<string, string | null>();
  for (const row of (memberResult.data ?? []) as MemberRow[]) {
    members.set(row.conversation_id, [...(members.get(row.conversation_id) ?? []), row.profile_id]);
    readAt.set(row.conversation_id, {
      ...(readAt.get(row.conversation_id) ?? {}),
      [row.profile_id]: row.last_read_at,
    });
    if (row.profile_id === myId) myLastRead.set(row.conversation_id, row.last_read_at);
  }

  const ids = (convResult.data ?? []).map((c) => c.id as string);
  const [unread, previews] = await Promise.all([
    unreadCounts(ids, myLastRead, myId),
    lastMessages(ids),
  ]);

  return (convResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) ?? undefined,
    isGroup: Boolean(row.is_group),
    members: members.get(row.id as string) ?? [],
    createdAt: row.created_at as string,
    lastMessageAt: (row.last_message_at as string) ?? undefined,
    unread: unread.get(row.id as string) ?? 0,
    readAt: readAt.get(row.id as string) ?? {},
    lastMessage: previews.get(row.id as string),
  }));
}

/** The newest message in each conversation, for the list preview. */
async function lastMessages(
  conversationIds: string[],
): Promise<Map<string, { authorId: string | null; body: string; hasAttachment: boolean }>> {
  const out = new Map<string, { authorId: string | null; body: string; hasAttachment: boolean }>();
  if (conversationIds.length === 0) return out;

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, author_id, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });
  if (error) return out;

  const newest: { id: string; conversation_id: string; author_id: string | null; body: string }[] = [];
  for (const row of (data ?? []) as typeof newest) {
    // Ordered newest first, so the first one seen per conversation is the one.
    if (!out.has(row.conversation_id)) {
      out.set(row.conversation_id, { authorId: row.author_id, body: row.body, hasAttachment: false });
      newest.push(row);
    }
  }

  // "Attachment" as the preview when a message is only a file.
  const bodyless = newest.filter((m) => !m.body).map((m) => m.id);
  if (bodyless.length) {
    const { data: atts } = await supabase
      .from("attachments")
      .select("owner_id")
      .eq("owner_table", "messages")
      .in("owner_id", bodyless);
    const withFiles = new Set((atts ?? []).map((a) => a.owner_id as string));
    for (const m of newest) {
      if (withFiles.has(m.id)) {
        const entry = out.get(m.conversation_id);
        if (entry) entry.hasAttachment = true;
      }
    }
  }
  return out;
}

/**
 * Unread is whatever arrived after your own last_read_at, and never your own
 * messages. Counted from the message rows rather than kept as a tally, because
 * a counter incremented on send and zeroed on open is wrong for good the first
 * time an increment is missed.
 */
async function unreadCounts(
  conversationIds: string[],
  lastRead: Map<string, string | null>,
  myId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (conversationIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id, author_id, created_at")
    .in("conversation_id", conversationIds);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as { conversation_id: string; author_id: string | null; created_at: string }[]) {
    if (row.author_id === myId) continue;
    const seenUpTo = lastRead.get(row.conversation_id);
    if (seenUpTo && row.created_at <= seenUpTo) continue;
    counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
  }
  return counts;
}

export const conversationsCache = createCache<Conversation>(fetchConversations);

// ---------------------------------------------------------------------------
// Messages
//
// One conversation's messages at a time. The whole history of every thread is
// not something a chat screen needs, and it is not something to hold in memory.
// ---------------------------------------------------------------------------

const messageCaches = new Map<string, ReturnType<typeof createCache<ChatMessage>>>();

export function messagesCache(conversationId: string) {
  let cache = messageCaches.get(conversationId);
  if (!cache) {
    cache = createCache<ChatMessage>(() => fetchMessages(conversationId));
    messageCaches.set(conversationId, cache);
  }
  return cache;
}

async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, author_id, body, reply_to_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    conversation_id: string;
    author_id: string | null;
    body: string;
    reply_to_id: string | null;
    created_at: string;
  }[];

  const attachments = await attachmentsFor(rows.map((r) => r.id));

  return rows.map((row) => ({
    id: row.id,
    convId: row.conversation_id,
    authorId: row.author_id,
    body: row.body,
    ts: row.created_at,
    replyToId: row.reply_to_id ?? undefined,
    attachments: attachments.get(row.id),
  }));
}

async function attachmentsFor(messageIds: string[]): Promise<Map<string, ChatAttachment[]>> {
  const out = new Map<string, ChatAttachment[]>();
  if (messageIds.length === 0) return out;

  const { data, error } = await supabase
    .from("attachments")
    .select("id, owner_id, storage_path, file_name, mime_type, size_bytes")
    .eq("owner_table", "messages")
    .in("owner_id", messageIds);
  if (error) return out;

  for (const row of (data ?? []) as {
    id: string;
    owner_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
  }[]) {
    // Signed on demand: the bucket is private, and a URL that never expires
    // would be a way around the membership check the moment it is forwarded.
    const { data: signed } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(row.storage_path, 60 * 60);
    out.set(row.owner_id, [
      ...(out.get(row.owner_id) ?? []),
      {
        id: row.id,
        name: row.file_name,
        type: row.mime_type ?? "application/octet-stream",
        size: Number(row.size_bytes ?? 0),
        url: signed?.signedUrl,
      },
    ]);
  }
  return out;
}

// ---------------------------------------------------------------------------

export const MessengerStore = {
  listConversations(): Conversation[] {
    return conversationsCache.list();
  },
  loadConversations(): Promise<Conversation[]> {
    return conversationsCache.ensureLoaded();
  },
  getConversation(id: string): Conversation | undefined {
    return this.listConversations().find((c) => c.id === id);
  },
  messagesFor(conversationId: string): ChatMessage[] {
    return messagesCache(conversationId).list();
  },

  /**
   * Starts a conversation.
   *
   * The creator is inserted as a member first: every other membership check
   * asks whether you are already in the conversation, and at this point nobody
   * is.
   */
  async createConversation(isGroup: boolean, members: string[], name?: string): Promise<Conversation> {
    const myId = me();
    if (!myId) throw new Error("You must be signed in to start a conversation.");

    const { data, error } = await supabase
      .from("conversations")
      .insert({ is_group: isGroup, name: name ?? null, created_by: myId })
      .select("id, name, is_group, created_at, last_message_at")
      .single();
    if (error) throw new Error(error.message);

    const everyone = Array.from(new Set([myId, ...members]));
    const { error: memberError } = await supabase
      .from("conversation_members")
      .insert(everyone.map((profile_id) => ({ conversation_id: data.id as string, profile_id })));
    if (memberError) throw new Error(memberError.message);

    await conversationsCache.refresh();
    return {
      id: data.id as string,
      name: (data.name as string) ?? undefined,
      isGroup: Boolean(data.is_group),
      members: everyone,
      createdAt: data.created_at as string,
      unread: 0,
      readAt: {},
    };
  },

  async sendMessage(
    convId: string,
    body: string,
    files?: File[],
    replyToId?: string,
    authorName?: string,
  ): Promise<ChatMessage> {
    const conversation = this.getConversation(convId);
    const myId = me();
    if (!myId) throw new Error("You must be signed in to send a message.");

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, body, reply_to_id: replyToId ?? null })
      .select("id, conversation_id, author_id, body, reply_to_id, created_at")
      .single();
    if (error) throw new Error(error.message);

    if (files?.length) {
      await uploadAttachments(convId, data.id as string, files);
    }

    await messagesCache(convId).refresh();
    void conversationsCache.refresh();

    // Telling the others. Not awaited as a group: a notification that fails
    // must not make the message look like it failed to send.
    for (const uid of conversation?.members ?? []) {
      if (uid === myId) continue;
      void notify(
        uid,
        "message",
        authorName ? `New message from ${authorName}` : "New message",
        body.slice(0, 120),
        `/messenger/${convId}`,
      );
    }

    return {
      id: data.id as string,
      convId,
      authorId: data.author_id as string,
      body: data.body as string,
      ts: data.created_at as string,
      replyToId: (data.reply_to_id as string) ?? undefined,
    };
  },

  /** Moves your own high-water mark to now. */
  async markRead(convId: string): Promise<void> {
    const myId = me();
    if (!myId) return;
    const { error } = await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", convId)
      .eq("profile_id", myId);
    if (error) throw new Error(error.message);
    await conversationsCache.refresh();
  },

  async addMembers(convId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const { error } = await supabase
      .from("conversation_members")
      .upsert(
        userIds.map((profile_id) => ({ conversation_id: convId, profile_id })),
        { onConflict: "conversation_id,profile_id" },
      );
    if (error) throw new Error(error.message);
    await conversationsCache.refresh();
  },
};

/**
 * Files go to the private bucket under the conversation's id.
 *
 * The path prefix is what the storage policy reads to decide who may download
 * them, so it is not cosmetic.
 */
async function uploadAttachments(convId: string, messageId: string, files: File[]): Promise<void> {
  for (const file of files) {
    const path = `${convId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) throw new Error(`Could not attach ${file.name}: ${uploadError.message}`);

    const { error } = await supabase.from("attachments").insert({
      bucket_id: "message-attachments",
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      owner_table: "messages",
      owner_id: messageId,
      uploaded_by: me(),
    });
    if (error) throw new Error(`Could not record ${file.name}: ${error.message}`);
  }
}

/**
 * Subscribes to messages arriving in a conversation.
 *
 * Returns an unsubscribe function. As with notifications, the caller refreshes
 * on focus too: a dropped websocket would otherwise leave the thread looking
 * like nobody has replied.
 */
export function subscribeToMessages(conversationId: string, onArrive?: () => void): () => void {
  if (!me()) return () => undefined;

  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => {
        void messagesCache(conversationId).refresh();
        void conversationsCache.refresh();
        onArrive?.();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
