export type WaMessage = {
  id: string;
  threadId: string; // phone in E.164 or synthetic key
  from: 'customer' | 'me';
  phone: string; // customer phone
  body: string;
  ts: string; // ISO
  status?: 'sent' | 'delivered' | 'read' | 'failed';
};

export type WaThread = {
  id: string; // phone
  phone: string;
  customerId?: string;
  assignedTo?: string; // account id
  unread?: number;
  lastTs?: string;
  lastSnippet?: string;
};

const K = { threads: 'wa.threads', messages: 'wa.messages' };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch {} };

const normalizePhone = (p: string) => {
  const x = (p||'').replace(/[^\d+]/g, '');
  if (x.startsWith('+')) return x;
  // naive: assume local without country code; leave as-is for now
  return x;
};

export const WhatsAppStore = {
  normalizePhone,
  listThreads(): WaThread[] { return r<WaThread[]>(K.threads, []); },
  listMessages(): WaMessage[] { return r<WaMessage[]>(K.messages, []); },
  upsertThread(t: WaThread) { const all = this.listThreads(); const i = all.findIndex(x=> x.id===t.id); if(i>=0) all[i]=t; else all.push(t); w(K.threads, all); emit('wa.messages-changed'); return t; },
  addMessage(m: WaMessage) {
    const msgs = this.listMessages(); msgs.push(m); w(K.messages, msgs);
    // update thread
    const ths = this.listThreads(); let th = ths.find(t=> t.id===m.threadId);
    if (!th) { th = { id: m.threadId, phone: m.phone, unread: 0 }; ths.push(th); }
    th.lastTs = m.ts; th.lastSnippet = m.body.slice(0, 80);
    if (m.from === 'customer') th.unread = (th.unread||0)+1;
    w(K.threads, ths); emit('wa.messages-changed'); return m;
  },
  markRead(threadId: string) {
    const ths = this.listThreads(); const th = ths.find(t=> t.id===threadId); if (th) { th.unread = 0; w(K.threads, ths); emit('wa.messages-changed'); }
  },
  assign(threadId: string, userId?: string) {
    const ths = this.listThreads(); const th = ths.find(t=> t.id===threadId); if (th) { th.assignedTo = userId; w(K.threads, ths); emit('wa.messages-changed'); }
  },
  linkCustomer(threadId: string, customerId?: string) {
    const ths = this.listThreads(); const th = ths.find(t=> t.id===threadId); if (th) { th.customerId = customerId; w(K.threads, ths); emit('wa.messages-changed'); }
  },
  simulateInbound(phone: string, body: string) {
    const ph = normalizePhone(phone);
    const id = `wam_${Date.now()}`;
    const m: WaMessage = { id, threadId: ph, phone: ph, from: 'customer', body, ts: new Date().toISOString() };
    return this.addMessage(m);
  }
};
