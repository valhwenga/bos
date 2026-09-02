/**
 * A synchronous view of the signed-in user.
 *
 * Supabase is asynchronous, but `canAccess()` and the components that call it
 * are not, and there are dozens of such call sites. Rather than make every one
 * of them async, the session, profile and the role's access map are loaded once
 * after sign-in and cached here, and the rest of the app reads that snapshot
 * synchronously.
 *
 * The snapshot is a *convenience for rendering*, not a security boundary. It is
 * derived from data the server sent, but it lives in the browser and could be
 * tampered with. Every check it backs is also enforced by row level security,
 * which is what actually decides whether a row can be read or written.
 */

import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { AccessLevel, ModuleKey } from "./rolesStore";

export type ProfileStatus = "pending" | "active" | "inactive";

export type Profile = {
  id: string;
  email: string;
  name: string;
  roleId: string | null;
  status: ProfileStatus;
  /** Set on client portal logins; identifies the customer they represent. */
  clientId?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
};

/**
 * `loading` matters: on a reload the session is restored asynchronously, so a
 * guard that treats "not signed in yet" as "signed out" would bounce the user
 * to the login page on every refresh.
 */
export type SessionStatus = "loading" | "signed-out" | "signed-in";

export type SessionSnapshot = {
  status: SessionStatus;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** Empty when there is no role, which denies everything. */
  access: Partial<Record<ModuleKey, AccessLevel>>;
  /** Role's idle timeout, used by the app's session timer. */
  sessionTimeoutMinutes: number | null;
  roleName: string | null;
};

const EMPTY: SessionSnapshot = {
  status: "loading",
  user: null,
  session: null,
  profile: null,
  access: {},
  sessionTimeoutMinutes: null,
  roleName: null,
};

let snapshot: SessionSnapshot = EMPTY;
const listeners = new Set<(s: SessionSnapshot) => void>();

export function getSession(): SessionSnapshot {
  return snapshot;
}

export function subscribeSession(fn: (s: SessionSnapshot) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function publish(next: SessionSnapshot) {
  snapshot = next;
  for (const fn of listeners) fn(next);
  // Some older code listens for this on window rather than subscribing.
  try {
    window.dispatchEvent(new CustomEvent("auth-changed"));
  } catch {
    /* not in a browser */
  }
}

/**
 * Loads the profile and the role's access map for a signed-in user.
 *
 * A user with no profile row, or one that is pending or inactive, resolves to
 * no access rather than to an error — the app should show them a "waiting for
 * approval" state, not break.
 */
async function loadProfile(session: Session): Promise<SessionSnapshot> {
  const { data: profileRow, error } = await supabase
    .from("profiles")
    .select("id, email, name, role_id, status, client_id, job_title, avatar_url")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !profileRow) {
    return {
      status: "signed-in",
      user: session.user,
      session,
      profile: null,
      access: {},
      sessionTimeoutMinutes: null,
      roleName: null,
    };
  }

  const profile: Profile = {
    id: profileRow.id,
    email: profileRow.email,
    name: profileRow.name,
    roleId: profileRow.role_id,
    status: profileRow.status,
    clientId: profileRow.client_id,
    jobTitle: profileRow.job_title,
    avatarUrl: profileRow.avatar_url,
  };

  // Only an active user with a role gets any access at all.
  if (profile.status !== "active" || !profile.roleId) {
    return {
      status: "signed-in",
      user: session.user,
      session,
      profile,
      access: {},
      sessionTimeoutMinutes: null,
      roleName: null,
    };
  }

  const [{ data: accessRows }, { data: roleRow }] = await Promise.all([
    supabase.from("role_access").select("module, level").eq("role_id", profile.roleId),
    supabase
      .from("roles")
      .select("name, session_timeout_minutes")
      .eq("id", profile.roleId)
      .maybeSingle(),
  ]);

  const access: Partial<Record<ModuleKey, AccessLevel>> = {};
  for (const row of accessRows ?? []) {
    access[row.module as ModuleKey] = row.level as AccessLevel;
  }

  return {
    status: "signed-in",
    user: session.user,
    session,
    profile,
    access,
    sessionTimeoutMinutes: roleRow?.session_timeout_minutes ?? null,
    roleName: roleRow?.name ?? null,
  };
}

const SIGNED_OUT: SessionSnapshot = { ...EMPTY, status: "signed-out" };

async function applySession(session: Session | null) {
  if (!session) {
    publish(SIGNED_OUT);
    return;
  }
  publish(await loadProfile(session));
}

/** Re-reads the profile and access map, after an admin changes a role. */
export async function refreshSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  await applySession(data.session);
}

let started = false;

/**
 * Restores any persisted session and then tracks sign-in and sign-out.
 * Safe to call more than once.
 */
export function startSessionTracking(): void {
  if (started) return;
  started = true;

  void supabase.auth.getSession().then(({ data }) => applySession(data.session));

  supabase.auth.onAuthStateChange((event, session) => {
    // A token refresh carries the same user, so re-fetching the profile on
    // every refresh would mean a needless pair of requests each hour.
    if (event === "TOKEN_REFRESHED" && snapshot.status === "signed-in") {
      publish({ ...snapshot, session });
      return;
    }
    void applySession(session);
  });
}

/** Test seam: lets tests drive the snapshot without a server. */
export function __setSessionForTests(next: Partial<SessionSnapshot>): void {
  publish({ ...EMPTY, ...next });
}
