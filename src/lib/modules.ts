/**
 * The permission vocabulary: what a role can be granted access to.
 *
 * This lives apart from rolesStore so the repo that talks to Postgres can read
 * the module list without importing the store that imports the repo. That cycle
 * left `Modules` undefined at module-evaluation time, which surfaced as a
 * mystifying "cannot read properties of undefined" from an unrelated test.
 *
 * These keys are the `app_module` enum in the database. Adding one here means
 * adding it there too, or `role_access` will reject the write.
 */

export type AccessLevel = "full" | "edit" | "view" | "none";
export type RoleLevel = "Global" | "Company" | "Department" | "Team" | "External";

export type ModuleKey =
  | "dashboard"
  | "hrm.employees"
  | "hrm.departments"
  | "hrm.attendance"
  | "hrm.leave"
  | "hrm.payroll"
  | "hrm.performance"
  | "accounting"
  | "projects"
  | "inventory"
  | "support"
  | "settings"
  | "crm"
  | "email"
  | "messenger";

export const Modules: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "hrm.employees", label: "HRM • Employees" },
  { key: "hrm.departments", label: "HRM • Departments" },
  { key: "hrm.attendance", label: "HRM • Attendance" },
  { key: "hrm.leave", label: "HRM • Leave" },
  { key: "hrm.payroll", label: "HRM • Payroll" },
  { key: "hrm.performance", label: "HRM • Performance" },
  { key: "accounting", label: "Accounting" },
  { key: "projects", label: "Projects" },
  { key: "inventory", label: "Inventory" },
  { key: "support", label: "Support" },
  { key: "crm", label: "CRM" },
  { key: "settings", label: "Settings" },
  { key: "email", label: "Email" },
  { key: "messenger", label: "Messenger" },
];

export type Role = {
  id: string;
  name: string;
  level: RoleLevel;
  description?: string;
  access: Record<ModuleKey, AccessLevel>;
  require2FA?: boolean;
  /** Roles the system ships with. They can be edited but never deleted. */
  isSystem?: boolean;
  security?: {
    sessionTimeoutMinutes?: number;
  };
};
