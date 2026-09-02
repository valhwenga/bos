import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * These cover the rule that access fails closed.
 *
 * The defect this guards against is specific: the old resolver fell back to
 * Super Admin whenever a role could not be determined, so an unset or unknown
 * role silently became full access to everything. Every case below that has no
 * usable role must deny.
 *
 * This is the UI half of the check. The database enforces the same rule through
 * row level security, which is the half that actually protects the data.
 */

vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

const { __setSessionForTests } = await import("./session");
const { canAccess, getCurrentRole, NO_ACCESS_ROLE } = await import("./accessControl");

const signedIn = (access: Record<string, string>, roleId = "role_test") =>
  __setSessionForTests({
    status: "signed-in",
    profile: { id: "u1", email: "a@b.c", name: "A", roleId, status: "active" },
    access: access as never,
    roleName: "Test Role",
  });

beforeEach(() => {
  __setSessionForTests({ status: "signed-out" });
});

describe("canAccess", () => {
  it("denies everything when signed out", () => {
    expect(canAccess("hrm.payroll")).toBe(false);
    expect(canAccess("dashboard")).toBe(false);
    expect(canAccess("accounting", "view")).toBe(false);
  });

  it("denies while the session is still loading", () => {
    // A page that rendered during restore must not flash privileged content.
    __setSessionForTests({ status: "loading" });
    expect(canAccess("accounting", "view")).toBe(false);
  });

  it("denies a signed-in user whose account has no role", () => {
    __setSessionForTests({
      status: "signed-in",
      profile: { id: "u1", email: "a@b.c", name: "A", roleId: null, status: "pending" },
      access: {},
    });
    expect(canAccess("dashboard")).toBe(false);
    expect(getCurrentRole()).toBe(NO_ACCESS_ROLE);
  });

  it("denies a module the role has no entry for", () => {
    signedIn({ dashboard: "view" });
    expect(canAccess("hrm.payroll", "view")).toBe(false);
  });

  it("grants exactly the level held", () => {
    signedIn({ projects: "edit" });
    expect(canAccess("projects", "view")).toBe(true);
    expect(canAccess("projects", "edit")).toBe(true);
    expect(canAccess("projects", "full")).toBe(false);
  });

  it("treats an explicit none as no access", () => {
    signedIn({ accounting: "none" });
    expect(canAccess("accounting", "view")).toBe(false);
  });

  it("orders the levels none < view < edit < full", () => {
    const order = ["none", "view", "edit", "full"] as const;
    for (let held = 0; held < order.length; held++) {
      signedIn({ inventory: order[held] });
      for (let need = 0; need < order.length; need++) {
        expect(
          canAccess("inventory", order[need]),
          `held ${order[held]}, needed ${order[need]}`,
        ).toBe(held >= need);
      }
    }
  });
});

describe("the Super Admin fallback must stay gone", () => {
  it("grants nothing for an unresolvable role", () => {
    // The whole point: no role means no access, never administrator.
    for (const level of Object.values(NO_ACCESS_ROLE.access)) {
      expect(level).toBe("none");
    }
  });

  it("does not read a role from localStorage", () => {
    // Access used to come from a client-writable key, so this line was all it
    // took to become Super Admin.
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage;

    signedIn({ dashboard: "view" });
    localStorage.setItem("auth.roleId", "role_super_admin");
    expect(canAccess("hrm.payroll", "full")).toBe(false);
    expect(canAccess("accounting", "full")).toBe(false);
  });
});
