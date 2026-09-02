import { Modules, type AccessLevel, type ModuleKey, type Role } from "./rolesStore";
import { getSession } from "./session";

const ACCESS_ORDER = { none: 0, view: 1, edit: 2, full: 3 } as const;

/**
 * The role a session resolves to when no role can be determined — signed out,
 * awaiting approval, deactivated, or a role that no longer exists. It grants
 * nothing.
 *
 * This must never be replaced with a privileged fallback. Doing so makes every
 * unresolvable session a Super Admin, which is precisely the defect this
 * constant exists to prevent.
 */
export const NO_ACCESS_ROLE: Role = {
  id: "role_none",
  name: "No Access",
  level: "External",
  description: "Fallback for sessions whose role cannot be resolved",
  access: Object.fromEntries(Modules.map((m) => [m.key, "none" as AccessLevel])) as Record<ModuleKey, AccessLevel>,
};

/**
 * Resolve the current session's role, failing closed.
 *
 * The access map comes from the server (profiles.role_id joined to role_access)
 * and is cached in the session snapshot. It used to come from a localStorage
 * key the user could edit, so anyone could grant themselves Super Admin by
 * typing one line into the console.
 *
 * This remains a UI-layer convenience: it decides what to render, not what the
 * database will allow. Row level security is the actual boundary.
 */
export function getCurrentRole(): Role {
  const { access, roleId, roleName } = (() => {
    const s = getSession();
    return { access: s.access, roleId: s.profile?.roleId ?? null, roleName: s.roleName };
  })();

  if (!roleId) return NO_ACCESS_ROLE;

  return {
    id: roleId,
    name: roleName ?? roleId,
    level: "Team",
    description: "",
    access: Object.fromEntries(
      Modules.map((m) => [m.key, access[m.key] ?? ("none" as AccessLevel)]),
    ) as Record<ModuleKey, AccessLevel>,
  };
}

export function canAccess(module: ModuleKey, required: AccessLevel = "view"): boolean {
  const level = getSession().access[module] ?? "none";
  return ACCESS_ORDER[level] >= ACCESS_ORDER[required];
}
