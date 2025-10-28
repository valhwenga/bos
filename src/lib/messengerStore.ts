export type ChatAttachment = { id: string; name: string; type: string; size: number; dataUrl: string };
export type ChatMessage = { id: string; convId: string; authorId: string; body: string; ts: string; attachments?: ChatAttachment[]; delivered?: boolean; readBy?: string[]; replyToId?: string };
export type Conversation = {
  id: string;
  name?: string; // group name if isGroup
  isGroup: boolean;
  members: string[]; // user IDs
  createdAt: string;
  lastMessageAt?: string;
  unreadBy: Record<string, number>; // userId -> count
};

const K = { conversations: "im.conversations", messages: "im.messages" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
import { notify } from "@/lib/notificationsStore";
import { UsersStore } from "@/lib/usersStore";

export const MessengerStore = {
  listConversations(): Conversation[] { return r<Conversation[]>(K.conversations, []); },
  listMessages(): ChatMessage[] { return r<ChatMessage[]>(K.messages, []); },
  conversationsFor(userId: string): Conversation[] { return this.listConversations().filter(c => c.members.includes(userId)); },
  messagesFor(convId: string): ChatMessage[] { return this.listMessages().filter(m => m.convId === convId).sort((a,b)=> a.ts.localeCompare(b.ts)); },
  getConversation(id: string): Conversation | undefined { return this.listConversations().find(c => c.id === id); },
  upsertConversation(c: Conversation) { const all = this.listConversations(); const i = all.findIndex(x=> x.id===c.id); if(i>=0) all[i]=c; else all.unshift(c); w(K.conversations, all); return c; },
  upsertMessage(m: ChatMessage) { const all = this.listMessages(); const i = all.findIndex(x=> x.id===m.id); if(i>=0) all[i]=m; else all.push(m); w(K.messages, all); return m; },
  createConversation(isGroup: boolean, members: string[], name?: string): Conversation {
    const c: Conversation = { id: `c_${Math.random().toString(36).slice(2,8)}`, isGroup, members: Array.from(new Set(members)), name, createdAt: new Date().toISOString(), unreadBy: {} };
    return this.upsertConversation(c);
  },
  sendMessage(convId: string, authorId: string, body: string, attachments?: ChatAttachment[], replyToId?: string) {
    const c = this.getConversation(convId); if(!c) throw new Error('conversation not found');
    const m: ChatMessage = { id: `m_${Math.random().toString(36).slice(2,8)}`, convId, authorId, body, ts: new Date().toISOString(), attachments, delivered: true, readBy: [authorId], replyToId };
    this.upsertMessage(m);
    const next: Conversation = { ...c, lastMessageAt: m.ts, unreadBy: { ...c.unreadBy } };
    for (const uid of c.members) { if (uid !== authorId) next.unreadBy[uid] = (next.unreadBy[uid]||0) + 1; }
    this.upsertConversation(next);
    try {
      const author = UsersStore.list().find(u => u.id===authorId);
      for (const uid of c.members) {
        if (uid === authorId) continue;
        notify(uid, "message", author ? `New message from ${author.name}` : "New message", body.slice(0, 120), `/messenger/${convId}`);
      }
    } catch {}
    return m;
  },
  markRead(convId: string, userId: string) {
    const c = this.getConversation(convId); if(!c) return;
    const next: Conversation = { ...c, unreadBy: { ...c.unreadBy, [userId]: 0 } };
    this.upsertConversation(next);
    // mark each message as read by user
    const all = this.listMessages();
    let changed = false;
    for (const msg of all) {
      if (msg.convId === convId) {
        msg.readBy = Array.from(new Set([...(msg.readBy||[]), userId]));
        changed = true;
      }
    }
    if (changed) w(K.messages, all);
  },
  addMembers(convId: string, userIds: string[]) {
    const c = this.getConversation(convId); if(!c) return;
    const next: Conversation = { ...c, members: Array.from(new Set([...c.members, ...userIds])) };
    this.upsertConversation(next);
  }
};
