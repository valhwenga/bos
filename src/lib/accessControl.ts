import { RolesStore, Modules, type AccessLevel, type ModuleKey, type Role } from "./rolesStore";

const K = { roleId: "auth.roleId" };

const ACCESS_ORDER = { none: 0, view: 1, edit: 2, full: 3 } as const;

/**
 * The role a session resolves to when no role can be determined — an unset,
 * unknown or malformed `auth.roleId`. It grants nothing.
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
 * Note this is a UI-layer convenience only. It reads a client-writable value
 * and must not be treated as a security boundary — every check it backs has to
 * be mirrored server-side.
 */
export function getCurrentRole(): Role {
  try {
    const rid = localStorage.getItem(K.roleId);
    if (!rid) return NO_ACCESS_ROLE;
    return RolesStore.get(rid) ?? NO_ACCESS_ROLE;
  } catch {
    return NO_ACCESS_ROLE;
  }
}

export function setCurrentRole(id: string) {
  localStorage.setItem(K.roleId, id);
}

export function canAccess(module: ModuleKey, required: AccessLevel = "view"): boolean {
  const level = getCurrentRole().access[module] ?? "none";
  return ACCESS_ORDER[level] >= ACCESS_ORDER[required];
}
