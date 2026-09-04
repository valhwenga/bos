export type MailAddress = { name?: string; email: string };
export type MailAttachment = { id: string; name: string; type: string; size: number; dataUrl: string };
export type MailMessage = {
  id: string;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  subject: string;
  body: string; // HTML or plain
  date: string; // ISO
  attachments?: MailAttachment[];
  folder: "inbox" | "sent" | "drafts" | "trash";
  threadId?: string;
  read?: boolean;
};

export type SMTPSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean; // TLS
  username: string;
  password: string;
  fromName?: string;
  fromEmail?: string;
};

const K = { messages: "email.messages", smtp: "email.smtp" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const EmailStore = {
  list(): MailMessage[] { return r<MailMessage[]>(K.messages, []); },
  byFolder(folder: MailMessage["folder"]): MailMessage[] { return this.list().filter(m => m.folder === folder); },
  get(id: string): MailMessage | undefined { return this.list().find(m => m.id===id); },
  upsert(m: MailMessage) { const all = this.list(); const i = all.findIndex(x=> x.id===m.id); if(i>=0) all[i]=m; else all.unshift(m); w(K.messages, all); return m; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.messages, all); },
  move(id: string, folder: MailMessage["folder"]) { const m = this.get(id); if(!m) return; this.upsert({ ...m, folder }); },
  // SMTP settings are no longer kept here. They were held in localStorage,
  // password included, in plain text — and nothing ever read them to send
  // anything. Credentials belong to the send-email function's environment.
  //
  // Anything a previous version stored is cleared on load, so an old password
  // does not sit in a browser indefinitely.
  clearLegacySmtp() {
    try {
      localStorage.removeItem(K.smtp);
    } catch {
      void 0;
    }
  },

  // Simulate send: store to "sent" and optionally deliver to inbox (loopback)
  async send(m: Omit<MailMessage, "id" | "folder" | "date">) {
    const id = `m_${Math.random().toString(36).slice(2,8)}`;
    const date = new Date().toISOString();
    const sent: MailMessage = { ...m, id, date, folder: "sent" } as MailMessage;
    this.upsert(sent);
    try {
      // Notify internal recipients whose emails match. The directory is a
      // server read now, so this awaits it rather than reading localStorage.
      const { AuthStore } = await import("@/lib/authStore");
      const { notify } = await import("@/lib/notificationsStore");
      const users = await AuthStore.listAccounts();
      const cc = (m.cc || []) as MailAddress[];
      const toEmails = [...(m.to || []), ...cc].map(a => a.email.toLowerCase());
      for (const u of users) {
        if (u.email && toEmails.includes(u.email.toLowerCase())) {
          void notify(u.id, "email", `New email: ${m.subject}`, undefined, `/email/${id}`);
        }
      }
    } catch { void 0; }
    return sent;
  },
};
