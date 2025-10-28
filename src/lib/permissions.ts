export type Role = "admin" | "manager" | "member" | "viewer";

const K = { role: "auth.role" };

export const Permissions = {
  getRole(): Role { return (localStorage.getItem(K.role) as Role) || "admin"; },
  setRole(r: Role) { localStorage.setItem(K.role, r); },
  // Basic gates
  canViewProjects(): boolean { return true; },
  canEditProjects(): boolean { const r = this.getRole(); return r === "admin" || r === "manager"; },
  canEditTasks(): boolean { const r = this.getRole(); return r !== "viewer"; },
  canApproveLeave(): boolean { const r = this.getRole(); return r === "admin" || r === "manager"; },
  canViewPayroll(): boolean { const r = this.getRole(); return r !== "viewer"; },
};
