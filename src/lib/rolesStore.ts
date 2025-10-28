export type AccessLevel = "full" | "edit" | "view" | "none";
export type RoleLevel = "Global" | "Company" | "Department" | "Team" | "External";

export type ModuleKey =
  | "dashboard"
  | "hrm.employees"
  | "hrm.departments"
  | "hrm.attendance"
  | "hrm.payroll"
  | "hrm.performance"
  | "accounting"
  | "projects"
  | "inventory"
  | "support"
  | "settings"
  | "crm"
  | "email"
  | "messenger"
  | "whatsapp";

export const Modules: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "hrm.employees", label: "HRM • Employees" },
  { key: "hrm.departments", label: "HRM • Departments" },
  { key: "hrm.attendance", label: "HRM • Attendance" },
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
  { key: "whatsapp", label: "WhatsApp" },
];

export type Role = {
  id: string;
  name: string;
  level: RoleLevel;
  description?: string;
  access: Record<ModuleKey, AccessLevel>;
  require2FA?: boolean;
  security?: {
    sessionTimeoutMinutes?: number;
    allowedIpCidrs?: string[];
  };
};

const K = { roles: "user.roles" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const FULL: AccessLevel = "full";
const EDIT: AccessLevel = "edit";
const VIEW: AccessLevel = "view";
const NONE: AccessLevel = "none";

const baseAccess = (def: AccessLevel): Record<ModuleKey, AccessLevel> => Object.fromEntries(Modules.map(m => [m.key, def])) as any;

const SEED: Role[] = [
  {
    id: "role_super_admin",
    name: "Super Admin",
    level: "Global",
    description: "Owner of the platform",
    access: baseAccess(FULL),
    require2FA: true,
    security: { sessionTimeoutMinutes: 60 },
  },
  {
    id: "role_company_admin",
    name: "Company Admin",
    level: "Company",
    description: "Manages their company instance",
    access: {
      ...baseAccess(VIEW),
      dashboard: FULL,
      settings: FULL,
      crm: EDIT,
      projects: FULL,
      accounting: FULL,
      inventory: FULL,
      support: FULL,
      "hrm.employees": FULL,
      "hrm.departments": FULL,
      "hrm.attendance": FULL,
      "hrm.payroll": FULL,
      "hrm.performance": FULL,
    },
    require2FA: true,
    security: { sessionTimeoutMinutes: 60 },
  },
  {
    id: "role_hr_manager",
    name: "HR Manager",
    level: "Department",
    description: "Handles staff, payroll, attendance",
    access: { ...baseAccess(NONE), dashboard: VIEW, "hrm.employees": FULL, "hrm.departments": EDIT, "hrm.attendance": FULL, "hrm.payroll": FULL, "hrm.performance": EDIT },
    require2FA: false,
  },
  {
    id: "role_finance_manager",
    name: "Finance Manager",
    level: "Department",
    description: "Handles all financial records",
    access: { ...baseAccess(NONE), dashboard: VIEW, accounting: FULL, "hrm.payroll": EDIT, projects: VIEW },
    require2FA: true,
    security: { sessionTimeoutMinutes: 45 },
  },
  {
    id: "role_project_manager",
    name: "Project Manager",
    level: "Department",
    description: "Oversees projects, tasks, deadlines",
    access: { ...baseAccess(NONE), dashboard: VIEW, projects: FULL, support: VIEW },
  },
  {
    id: "role_inventory_manager",
    name: "Inventory Manager",
    level: "Department",
    description: "Manages stock, company assets",
    access: { ...baseAccess(NONE), dashboard: VIEW, inventory: FULL },
  },
  {
    id: "role_support_agent",
    name: "Support Agent",
    level: "Department",
    description: "Handles client support tickets",
    access: { ...baseAccess(NONE), support: FULL, projects: VIEW },
  },
  {
    id: "role_employee",
    name: "Employee",
    level: "Team",
    description: "Executes assigned work",
    access: { ...baseAccess(NONE), dashboard: VIEW, projects: EDIT, "hrm.attendance": EDIT, "hrm.employees": VIEW },
  },
  {
    id: "role_client",
    name: "Client",
    level: "External",
    description: "Limited client portal access",
    access: { ...baseAccess(NONE), projects: VIEW, support: VIEW },
  },
];

export const RolesStore = {
  list(): Role[] { 
    const list = r<Role[]>(K.roles, SEED);
    // Normalize to ensure all module keys are present
    const moduleKeys = Modules.map(m => m.key);
    const normalized = list.map(role => {
      const access = { ...role.access } as Record<ModuleKey, AccessLevel>;
      for (const k of moduleKeys) {
        if (!(k in access)) (access as any)[k] = "none";
      }
      // Super Admin: full access to everything
      if (role.id === "role_super_admin") {
        for (const k of moduleKeys) (access as any)[k] = "full";
      }
      return { ...role, access } as Role;
    });
    if (JSON.stringify(list) !== JSON.stringify(normalized)) w(K.roles, normalized);
    return normalized;
  },
  upsert(role: Role) { const all = this.list(); const i = all.findIndex(x => x.id === role.id); if (i>=0) all[i]=role; else all.push(role); w(K.roles, all); return role; },
  remove(id: string) { const all = this.list().filter(x => x.id !== id); w(K.roles, all); },
  get(id: string) { return this.list().find(x=> x.id===id); }
};
