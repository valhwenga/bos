export type PendingSignup = {
  id: string;
  name: string;
  email: string;
  password: string; // demo only; not for production
  requestedAt: string;
};

export type Account = {
  id: string;
  name: string;
  email: string;
  password: string; // demo only; not for production
  roleId: string;
  createdAt: string;
  active: boolean;
};

export type Invite = {
  id: string;
  email: string;
  roleId: string;
  token: string;
  invitedBy?: string;
  createdAt: string;
  acceptedAt?: string;
};

export type Session = {
  userId: string;
  createdAt: string;
};

export type ResetToken = {
  token: string;
  email: string;
  createdAt: string;
  used?: boolean;
};

const K = {
  accounts: "auth.accounts",
  pending: "auth.pending",
  invites: "auth.invites",
  session: "auth.session",
  resets: "auth.reset_tokens",
};

const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch {}
};

function seedAdmin() {
  const accs = r<Account[]>(K.accounts, []);
  if (accs.length === 0) {
    const admin: Account = { id: 'u_admin', name: 'Administrator', email: 'admin@example.com', password: 'admin', roleId: 'role_super_admin', createdAt: new Date().toISOString(), active: true };
    w(K.accounts, [admin]);
  }
}
seedAdmin();

export const AuthStore = {
  listAccounts(): Account[] { return r<Account[]>(K.accounts, []); },
  listPending(): PendingSignup[] { return r<PendingSignup[]>(K.pending, []); },
  listInvites(): Invite[] { return r<Invite[]>(K.invites, []); },
  listResets(): ResetToken[] { return r<ResetToken[]>(K.resets, []); },

  signUpRequest(name: string, email: string, password: string) {
    const pending = this.listPending();
    const exists = this.listAccounts().find(a=> a.email.toLowerCase()===email.toLowerCase());
    if (exists) throw new Error('Email already registered.');
    const req: PendingSignup = { id: `ps_${Date.now()}`, name, email, password, requestedAt: new Date().toISOString() };
    pending.push(req); w(K.pending, pending); emit('auth-changed'); return req;
  },

  requestPasswordReset(email: string) {
    const acc = this.listAccounts().find(a=> a.email.toLowerCase()===email.toLowerCase());
    if (!acc) throw new Error('No account found for that email');
    const toks = this.listResets();
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const rec: ResetToken = { token, email: acc.email, createdAt: new Date().toISOString() };
    toks.push(rec); w(K.resets, toks);
    try {
      // Lazy import to avoid cycles
      const mod = (window as any).EmailStore || null;
      // If EmailStore is globally not exposed, fallback to dynamic import via eval-like require is not available; we will attempt window dispatch
    } catch {}
    return rec;
  },

  resetPassword(token: string, newPassword: string) {
    const toks = this.listResets();
    const rec = toks.find(t=> t.token===token && !t.used);
    if (!rec) throw new Error('Invalid or used reset token');
    const accs = this.listAccounts();
    const acc = accs.find(a=> a.email.toLowerCase()===rec.email.toLowerCase());
    if (!acc) throw new Error('Account not found for token');
    acc.password = newPassword;
    w(K.accounts, accs);
    rec.used = true; w(K.resets, toks);
    return acc;
  },

  adminApprove(pendingId: string, roleId: string) {
    const pending = this.listPending();
    const idx = pending.findIndex(p=> p.id===pendingId);
    if (idx<0) throw new Error('Pending request not found');
    const p = pending[idx]; pending.splice(idx,1); w(K.pending, pending);
    const accs = this.listAccounts();
    const acc: Account = { id: `u_${Date.now()}`, name: p.name, email: p.email, password: p.password, roleId, createdAt: new Date().toISOString(), active: true };
    accs.push(acc); w(K.accounts, accs); emit('auth-changed'); return acc;
  },

  invite(email: string, roleId: string, invitedBy?: string) {
    const invs = this.listInvites();
    const inv: Invite = { id: `inv_${Date.now()}`, email, roleId, token: Math.random().toString(36).slice(2), invitedBy, createdAt: new Date().toISOString() };
    invs.push(inv); w(K.invites, invs); emit('auth-changed'); return inv;
  },

  acceptInvite(token: string, name: string, password: string) {
    const invs = this.listInvites();
    const idx = invs.findIndex(i=> i.token===token);
    if (idx<0) throw new Error('Invite not found');
    const inv = invs[idx]; inv.acceptedAt = new Date().toISOString(); w(K.invites, invs);
    const accs = this.listAccounts();
    const acc: Account = { id: `u_${Date.now()}`, name, email: inv.email, password, roleId: inv.roleId, createdAt: new Date().toISOString(), active: true };
    accs.push(acc); w(K.accounts, accs); emit('auth-changed'); return acc;
  },

  signIn(email: string, password: string) {
    const acc = this.listAccounts().find(a=> a.email.toLowerCase()===email.toLowerCase() && a.password===password && a.active);
    if (!acc) throw new Error('Invalid credentials or not approved.');
    const sess: Session = { userId: acc.id, createdAt: new Date().toISOString() };
    w(K.session, sess); localStorage.setItem('auth.roleId', acc.roleId); emit('auth-changed'); return acc;
  },
  signOut() { localStorage.removeItem(K.session); emit('auth-changed'); },
  currentSession(): Session | null { return r<Session | null>(K.session, null); },
  currentUser(): Account | undefined { const s = this.currentSession(); if (!s) return undefined; return this.listAccounts().find(a=> a.id===s.userId); },
  isAuthed(): boolean { return !!this.currentSession(); }
};
