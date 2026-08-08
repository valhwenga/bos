import { SecurityStore } from './securityStore';

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
  clientId?: string;
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
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch { void 0; }
};

/**
 * Development seed accounts.
 *
 * `roleId` MUST match an id defined in rolesStore's SEED. These previously read
 * 'admin' / 'manager' / 'employee' / 'viewer', none of which exist there, so
 * every role lookup missed and every account silently resolved to Super Admin.
 */
const SEED_ACCOUNTS: ReadonlyArray<Omit<Account, "createdAt">> = [
  { id: 'user_admin',    name: 'SpikeTech Administrator', email: 'admin@spiketech.co.za', password: 'Password@00', roleId: 'role_super_admin',   active: true },
  { id: 'user_manager',  name: 'Office Manager',          email: 'manager@company.com',   password: 'password',    roleId: 'role_company_admin', active: true },
  { id: 'user_employee', name: 'Sales Employee',          email: 'employee@company.com',  password: 'password',    roleId: 'role_employee',      active: true },
  { id: 'user_viewer',   name: 'Report Viewer',           email: 'viewer@company.com',    password: 'password',    roleId: 'role_viewer',        active: true },
];

function seedAdmin() {
  if (r<Account[]>(K.accounts, []).length > 0) return;
  const createdAt = new Date().toISOString();
  w(K.accounts, SEED_ACCOUNTS.map((a) => ({ ...a, createdAt })));
}
seedAdmin();

/**
 * Repairs sessions and accounts seeded before the role ids were corrected.
 * Without this, existing browsers keep their unresolvable roleId and continue
 * falling back to whatever getCurrentRole decides — now "no access".
 */
function migrateLegacyRoleIds() {
  const legacy: Record<string, string> = {
    admin: 'role_super_admin',
    manager: 'role_company_admin',
    employee: 'role_employee',
    viewer: 'role_viewer',
  };
  try {
    const accounts = r<Account[]>(K.accounts, []);
    let changed = false;
    for (const acc of accounts) {
      if (legacy[acc.roleId]) { acc.roleId = legacy[acc.roleId]; changed = true; }
    }
    if (changed) w(K.accounts, accounts);

    const currentRoleId = localStorage.getItem('auth.roleId');
    if (currentRoleId && legacy[currentRoleId]) {
      localStorage.setItem('auth.roleId', legacy[currentRoleId]);
    }
  } catch { void 0; }
}
migrateLegacyRoleIds();

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
      const wAny = window as unknown as { EmailStore?: unknown };
      const mod = wAny.EmailStore || null;
      // If EmailStore is globally not exposed, fallback to dynamic import via eval-like require is not available; we will attempt window dispatch
      void mod;
    } catch { void 0; }
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
    const acc = this.listAccounts().find(a=>
      a.email.toLowerCase()===email.toLowerCase() &&
      a.password===password &&
      a.active
    );
    if (!acc) throw new Error('Invalid credentials or not approved.');

    const sess: Session = { userId: acc.id, createdAt: new Date().toISOString() };
    w(K.session, sess);
    localStorage.setItem('auth.roleId', acc.roleId);
    emit('auth-changed');
    return acc;
  },
  signOut() { localStorage.removeItem(K.session); emit('auth-changed'); },
  currentSession(): Session | null { return r<Session | null>(K.session, null); },
  currentUser(): Account | undefined { const s = this.currentSession(); if (!s) return undefined; return this.listAccounts().find(a=> a.id===s.userId); },
  isAuthed(): boolean { return !!this.currentSession(); },

  upsertAccount(acc: Account) {
    const all = this.listAccounts();
    const i = all.findIndex(a => a.id === acc.id);
    if (i >= 0) all[i] = { ...all[i], ...acc };
    else all.push(acc);
    w(K.accounts, all);
    emit('auth-changed');
    return acc;
  },

  setAccountActive(userId: string, active: boolean) {
    const all = this.listAccounts();
    const i = all.findIndex(a => a.id === userId);
    if (i < 0) return;
    all[i] = { ...all[i], active };
    w(K.accounts, all);
    emit('auth-changed');
    return all[i];
  },

  createClientAccount(input: { name: string; email: string; password: string; roleId: string; clientId: string; active?: boolean }) {
    const existsEmail = this.listAccounts().find(a => a.email.toLowerCase() === input.email.toLowerCase());
    if (existsEmail) throw new Error('Email already registered.');
    const acc: Account = {
      id: `u_${Date.now()}`,
      name: input.name,
      email: input.email,
      password: input.password,
      roleId: input.roleId,
      clientId: input.clientId,
      createdAt: new Date().toISOString(),
      active: input.active ?? true,
    };
    this.upsertAccount(acc);
    return acc;
  },
};
