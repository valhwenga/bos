/**
 * Authentication, backed by Supabase.
 *
 * This used to hold accounts in localStorage with their passwords in plain
 * text, and sign in by comparing `account.password === password` in the
 * browser. Anyone with devtools could read every password in the company, and
 * `auth.roleId` sat beside them in localStorage, so granting yourself Super
 * Admin took one line in the console.
 *
 * Credentials now live in auth.users, hashed and server-side; the browser never
 * sees them. Roles come from profiles.role_id and are enforced by row level
 * security, so editing anything locally changes what the UI draws but not what
 * the database will return.
 *
 * Reads of the *current* user stay synchronous, served from the session
 * snapshot, because the components that call them are synchronous. Anything
 * that touches other users' records is a server call and is async.
 */

import { supabase } from "./supabase";
import { getSession, refreshSession, type Profile } from "./session";

export type Account = {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  status: "pending" | "active" | "inactive";
  /** Set on client portal logins; identifies the customer they represent. */
  clientId?: string | null;
  createdAt: string;
  /** Retained so existing callers that branch on `active` keep working. */
  active: boolean;
};

export type PendingSignup = {
  id: string;
  name: string;
  email: string;
  requestedAt: string;
};

export type Session = { userId: string; createdAt: string };

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role_id: string | null;
  status: "pending" | "active" | "inactive";
  client_id: string | null;
  created_at: string;
};

const toAccount = (row: ProfileRow): Account => ({
  id: row.id,
  name: row.name,
  email: row.email,
  roleId: row.role_id,
  status: row.status,
  clientId: row.client_id,
  createdAt: row.created_at,
  active: row.status === "active",
});

const profileToAccount = (p: Profile): Account => ({
  id: p.id,
  name: p.name,
  email: p.email,
  roleId: p.roleId,
  status: p.status,
  clientId: p.clientId,
  createdAt: "",
  active: p.status === "active",
});

export const AuthStore = {
  // --- Current user: synchronous, from the session snapshot ----------------

  currentUser(): Account | undefined {
    const p = getSession().profile;
    return p ? profileToAccount(p) : undefined;
  },

  isAuthed(): boolean {
    return getSession().status === "signed-in";
  },

  currentSession(): Session | null {
    const s = getSession();
    if (s.status !== "signed-in" || !s.user) return null;
    return { userId: s.user.id, createdAt: s.user.created_at ?? "" };
  },

  /** True once the persisted session has been restored, or found absent. */
  isReady(): boolean {
    return getSession().status !== "loading";
  },

  // --- Credentials ---------------------------------------------------------

  async signIn(email: string, password: string): Promise<Account> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // An unconfirmed address is only reported once the password is correct,
      // so saying so reveals nothing the caller does not already know — and
      // "invalid email or password" would send someone off resetting a
      // password that was never the problem.
      if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
        throw new Error(
          "Confirm your email address first — open the link we sent you when you signed up.",
        );
      }
      // Otherwise Supabase deliberately returns the same message whether the
      // address is unknown or the password is wrong, so the form cannot be used
      // to discover who has an account. Keep it that way.
      throw new Error("Invalid email or password.");
    }

    await refreshSession();

    const snap = getSession();
    if (!snap.profile) throw new Error("Your account has no profile. Ask an administrator to set one up.");
    if (snap.profile.status === "pending") {
      await supabase.auth.signOut();
      throw new Error("Your account is waiting for approval.");
    }
    if (snap.profile.status === "inactive") {
      await supabase.auth.signOut();
      throw new Error("Your account has been deactivated.");
    }
    if (!data.session) throw new Error("Sign in did not return a session.");
    return profileToAccount(snap.profile);
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /**
   * Registers an account, which then waits for an administrator to approve it
   * and assign a role. The database trigger creates the profile as 'pending',
   * and a pending profile resolves to no access.
   */
  async signUpRequest(name: string, email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
  },

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    // Do not reveal whether the address exists.
    if (error && !/not found/i.test(error.message)) throw new Error(error.message);
  },

  /**
   * Sets a new password. The user arrives here from the emailed link, which
   * Supabase exchanges for a recovery session, so there is no token to pass.
   */
  async resetPassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  /**
   * True when the emailed reset or invite link produced a usable session.
   * Guards the reset form so it cannot be submitted into nothing.
   */
  async hasRecoverySession(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  },

  /** Sets the display name on the signed-in user's own profile. */
  async setOwnName(name: string): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("Not signed in.");
    const { error } = await supabase.from("profiles").update({ name }).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  // --- Administration ------------------------------------------------------
  //
  // These are ordinary table writes. RLS allows them only for a user with
  // 'full' access to settings, so a non-admin calling them gets nothing back
  // rather than a client-side check they could skip.

  async listAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role_id, status, client_id, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toAccount);
  },

  async listPending(): Promise<PendingSignup[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, role_id, status, client_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      requestedAt: row.created_at,
    }));
  },

  /** Approves a signup and gives it a role. */
  async adminApprove(userId: string, roleId: string): Promise<void> {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "active", role_id: roleId })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  },

  async setAccountActive(userId: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from("profiles")
      .update({ status: active ? "active" : "inactive" })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  },

  async setAccountRole(userId: string, roleId: string): Promise<void> {
    const { error } = await supabase.from("profiles").update({ role_id: roleId }).eq("id", userId);
    if (error) throw new Error(error.message);
  },

  /**
   * Creates an account for somebody else.
   *
   * This cannot happen in the browser: it needs the service_role key, which
   * bypasses row level security and must never be shipped to a client. The
   * admin-create-user edge function does it, re-checking the caller's
   * permission against the database rather than trusting the UI.
   */
  async createUser(input: {
    name: string;
    email: string;
    password: string;
    roleId: string;
    clientId?: string | null;
  }): Promise<Account> {
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: input,
    });
    if (error) {
      const message = (data as { error?: string } | null)?.error;
      throw new Error(message || error.message);
    }
    const result = data as { id: string; email: string; name: string; roleId: string; clientId: string | null };
    return {
      id: result.id,
      name: result.name,
      email: result.email,
      roleId: result.roleId,
      clientId: result.clientId,
      status: "active",
      createdAt: new Date().toISOString(),
      active: true,
    };
  },

  /** A client portal login for a customer record. */
  async createClientAccount(input: {
    name: string;
    email: string;
    password: string;
    roleId: string;
    clientId: string;
  }): Promise<Account> {
    return this.createUser(input);
  },
};
