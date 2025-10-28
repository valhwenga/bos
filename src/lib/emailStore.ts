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
  smtp(): SMTPSettings { return r<SMTPSettings>(K.smtp, { enabled: false, host: "", port: 587, secure: false, username: "", password: "", fromName: "", fromEmail: "" }); },
  setSmtp(s: SMTPSettings) { w(K.smtp, s); return s; },

  // Simulate send: store to "sent" and optionally deliver to inbox (loopback)
  async send(m: Omit<MailMessage, "id" | "folder" | "date">) {
    const id = `m_${Math.random().toString(36).slice(2,8)}`;
    const date = new Date().toISOString();
    const sent: MailMessage = { ...m, id, date, folder: "sent" } as MailMessage;
    this.upsert(sent);
    try {
      // Notify internal recipients whose emails match
      const { UsersStore } = await import("@/lib/usersStore");
      const { notify } = await import("@/lib/notificationsStore");
      const users = UsersStore.list();
      const toEmails = [...(m.to||[]), ...((m.cc||[]) as any[])].map(a => a.email.toLowerCase());
      for (const u of users) {
        if (u.email && toEmails.includes(u.email.toLowerCase())) {
          notify(u.id, "email", `New email: ${m.subject}`, undefined, `/email/${id}`);
        }
      }
    } catch {}
    return sent;
  },
};
