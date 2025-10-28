import { RolesStore, type ModuleKey, type Role } from "./rolesStore";

const K = { roleId: "auth.roleId" };

export function getCurrentRole(): Role {
  try {
    const rid = localStorage.getItem(K.roleId);
    const role = rid ? RolesStore.get(rid) : undefined;
    return role || (RolesStore.get("role_super_admin") || RolesStore.list()[0]!);
  } catch {
    return RolesStore.list()[0]!;
  }
}

export function setCurrentRole(id: string) {
  localStorage.setItem(K.roleId, id);
}

export function canAccess(module: ModuleKey, required: "view" | "edit" | "full"): boolean {
  const role = getCurrentRole();
  const lvl = role.access[module] || "none";
  const order = { none: 0, view: 1, edit: 2, full: 3 } as const;
  return order[lvl] >= order[required];
}
