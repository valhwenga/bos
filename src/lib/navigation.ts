import {
  LayoutDashboard,
  Users,
  Calculator,
  FolderKanban,
  ShoppingCart,
  CreditCard,
  Headphones,
  Video,
  MessagesSquare,
  Mail,
  Settings as SettingsIcon,
} from "lucide-react";
import { canAccess } from "@/lib/accessControl";
import type { ModuleKey } from "@/lib/rolesStore";

export type NavChild = { name: string; path: string };

export type NavItem = {
  name: string;
  path: string;
  icon: React.ElementType;
  module?: ModuleKey;
  children?: NavChild[];
};

/**
 * The single source of navigation truth, shared by the desktop sidebar, the
 * mobile drawer and the command palette. Adding a route here surfaces it in
 * all three; it previously lived only in Sidebar.tsx, which is how five built
 * modules ended up unreachable.
 */
export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, module: "dashboard" },
  {
    name: "HRM",
    path: "/hrm",
    icon: Users,
    module: "hrm.employees",
    children: [
      { name: "Employees", path: "/hrm/employees" },
      { name: "Departments", path: "/hrm/departments" },
      { name: "Attendance", path: "/hrm/attendance" },
      { name: "Leave", path: "/hrm/leave" },
      { name: "Payroll", path: "/hrm/payroll" },
      { name: "Manage Payroll", path: "/hrm/payroll/manage" },
      { name: "Performance", path: "/hrm/performance" },
    ],
  },
  {
    name: "Accounting",
    path: "/accounting",
    icon: Calculator,
    module: "accounting",
    children: [
      { name: "Quotations", path: "/accounting/quotations" },
      { name: "Invoices", path: "/accounting/invoices" },
      { name: "Customers", path: "/accounting/customers" },
      { name: "Products", path: "/accounting/products" },
      { name: "Taxes", path: "/accounting/taxes" },
      { name: "Payments", path: "/accounting/payments" },
      { name: "Expenses", path: "/accounting/expenses" },
      { name: "Reports", path: "/accounting/reports" },
      { name: "Settings", path: "/accounting/settings" },
    ],
  },
  {
    name: "Projects",
    path: "/projects",
    icon: FolderKanban,
    module: "projects",
    children: [
      { name: "All Projects", path: "/projects" },
      { name: "Tasks", path: "/projects/tasks" },
      { name: "Timesheet", path: "/projects/timesheet" },
      { name: "Bugs", path: "/projects/bug" },
      { name: "Calendar", path: "/projects/calendar" },
      { name: "Tracker", path: "/projects/tracker" },
      { name: "Reports", path: "/projects/report" },
    ],
  },
  {
    name: "CRM",
    path: "/crm",
    icon: Users,
    module: "crm",
    children: [
      { name: "Leads", path: "/crm/leads" },
      { name: "Customers", path: "/crm/customers" },
      { name: "Deals", path: "/crm/deals" },
      { name: "Tasks", path: "/crm/tasks" },
      { name: "Reports", path: "/crm/reports" },
    ],
  },
  {
    name: "Support",
    path: "/support",
    icon: Headphones,
    module: "support",
    children: [
      { name: "Dashboard", path: "/support" },
      { name: "Tickets", path: "/support/tickets" },
      { name: "Settings", path: "/support/settings" },
    ],
  },
  {
    name: "Email",
    path: "/email/sent",
    icon: Mail,
    module: "email",
    children: [
      { name: "Sent", path: "/email/sent" },
      { name: "Compose", path: "/email/compose" },
    ],
  },
  { name: "Messenger", path: "/messenger", icon: MessagesSquare, module: "messenger" },
  { name: "Products", path: "/products", icon: ShoppingCart, module: "inventory" },
  { name: "Point of Sale", path: "/pos", icon: CreditCard, module: "inventory" },
  { name: "Meetings", path: "/zoom", icon: Video, module: "dashboard" },
  {
    name: "Users",
    path: "/users",
    icon: Users,
    module: "settings",
    children: [
      { name: "All Users", path: "/users" },
      { name: "Roles", path: "/users/role" },
      { name: "Clients", path: "/users/client" },
      { name: "Pending approvals", path: "/users/pending" },
      { name: "Audit logs", path: "/users/audit" },
    ],
  },
  {
    name: "Settings",
    path: "/settings/company",
    icon: SettingsIcon,
    module: "settings",
    children: [
      { name: "Company", path: "/settings/company" },
      { name: "Email (SMTP)", path: "/settings/company/email" },
      { name: "Export data", path: "/settings/export" },
    ],
  },
];

/** Which permission module a route belongs to. */
export function moduleForPath(path: string): ModuleKey | undefined {
  if (path === "/" || path.startsWith("/zoom")) return "dashboard";

  if (path.startsWith("/hrm/employees")) return "hrm.employees";
  if (path.startsWith("/hrm/departments")) return "hrm.departments";
  if (path.startsWith("/hrm/attendance")) return "hrm.attendance";
  if (path.startsWith("/hrm/leave")) return "hrm.leave";
  if (path.startsWith("/hrm/payroll")) return "hrm.payroll";
  if (path.startsWith("/hrm/performance")) return "hrm.performance";
  if (path.startsWith("/accounting")) return "accounting";
  if (path.startsWith("/projects")) return "projects";
  if (path.startsWith("/crm")) return "crm";
  if (path.startsWith("/support") || path.startsWith("/portal/support")) return "support";
  if (path.startsWith("/products") || path.startsWith("/pos")) return "inventory";
  if (path.startsWith("/users") || path.startsWith("/settings")) return "settings";
  if (path.startsWith("/email")) return "email";
  if (path.startsWith("/messenger")) return "messenger";
  return undefined;
}

export function canSeePath(path: string): boolean {
  const module = moduleForPath(path);
  return module ? canAccess(module, "view") : false;
}

export function visibleChildren(item: NavItem): NavChild[] {
  return item.children?.filter((c) => canSeePath(c.path)) ?? [];
}

export function canSeeItem(item: NavItem): boolean {
  if (item.children?.length) return visibleChildren(item).length > 0;
  return item.module ? canAccess(item.module, "view") : true;
}

/** Nav filtered to what the current role may actually reach. */
export function visibleNav(): NavItem[] {
  return NAV_ITEMS.filter(canSeeItem);
}

export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.children?.length) {
    return item.children.some((c) => pathname === c.path || pathname.startsWith(c.path + "/")) || pathname === item.path;
  }
  if (item.path === "/") return pathname === "/";
  return pathname === item.path || pathname.startsWith(item.path + "/");
}

/** Flat list of reachable destinations, for the command palette. */
export function searchableDestinations(): Array<{ name: string; path: string; group: string; icon: React.ElementType }> {
  const out: Array<{ name: string; path: string; group: string; icon: React.ElementType }> = [];
  for (const item of visibleNav()) {
    const children = visibleChildren(item);
    if (children.length) {
      for (const child of children) {
        out.push({ name: child.name, path: child.path, group: item.name, icon: item.icon });
      }
    } else {
      out.push({ name: item.name, path: item.path, group: "General", icon: item.icon });
    }
  }
  return out;
}
