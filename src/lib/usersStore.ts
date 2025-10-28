export type UserStatus = "active" | "inactive";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  roleId: string; // references RolesStore
  status: UserStatus;
  twoFactorEnabled?: boolean;
  createdAt: string; // ISO
};

const K = { users: "user.users" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: AppUser[] = [];

export const UsersStore = {
  list(): AppUser[] { return r<AppUser[]>(K.users, SEED); },
  upsert(u: AppUser) { const all = this.list(); const i = all.findIndex(x=> x.id===u.id); if(i>=0) all[i]=u; else all.push(u); w(K.users, all); return u; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.users, all); },
  get(id: string) { return this.list().find(x=> x.id===id); }
};
