import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Calculator, 
  Handshake, 
  FolderKanban,
  ShoppingCart,
  CreditCard,
  Headphones,
  Video,
  MessageSquare,
  Mail,
  Settings as SettingsIcon,
  BarChart3,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanySettingsStore } from "@/lib/companySettings";
import { useEffect, useState } from "react";
import { canAccess } from "@/lib/accessControl";
import type { ModuleKey } from "@/lib/rolesStore";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  children?: { name: string; path: string }[];
  module?: ModuleKey;
}

const navItems: NavItem[] = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, module: "dashboard" },
  { 
    name: "HRM System", 
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
    ]
  },
  { 
    name: "Accounting System", 
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
    ]
  },
  { 
    name: "Project System", 
    path: "/projects", 
    icon: FolderKanban,
    module: "projects",
    children: [
      { name: "Projects", path: "/projects" },
      { name: "Tasks", path: "/projects/tasks" },
      { name: "Timesheet", path: "/projects/timesheet" },
      { name: "Bug", path: "/projects/bug" },
      { name: "Task Calendar", path: "/projects/calendar" },
      { name: "Tracker", path: "/projects/tracker" },
      { name: "Project Report", path: "/projects/report" },
    ]
  },
  { 
    name: "User Management", 
    path: "/users", 
    icon: Users,
    module: "settings",
    children: [
      { name: "User", path: "/users" },
      { name: "Role", path: "/users/role" },
      { name: "Client", path: "/users/client" },
    ]
  },
  { name: "Products System", path: "/products", icon: ShoppingCart, module: "inventory" },
  { name: "POS System", path: "/pos", icon: CreditCard, module: "inventory" },
  { 
    name: "Support System", 
    path: "/support", 
    icon: Headphones,
    module: "support",
    children: [
      { name: "Dashboard", path: "/support" },
      { name: "Tickets", path: "/support/tickets" },
      { name: "Settings", path: "/support/settings" },
    ]
  },
  { name: "Zoom Meeting", path: "/zoom", icon: Video, module: "dashboard" },
  { name: "Messenger", path: "/messenger", icon: MessageSquare, module: "messenger" },
  { 
    name: "WhatsApp", 
    path: "/whatsapp", 
    icon: MessageSquare,
    module: "whatsapp",
    children: [
      { name: "Console", path: "/whatsapp" },
      { name: "Settings", path: "/whatsapp/settings" },
    ]
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
    ]
  },
  { 
    name: "Email", 
    path: "/email", 
    icon: Mail,
    module: "email",
    children: [
      { name: "Inbox", path: "/email" },
      { name: "Sent", path: "/email/sent" },
      { name: "Compose", path: "/email/compose" },
    ]
  },
  {
    name: "Operations",
    path: "/analytics",
    icon: BarChart3,
    module: "dashboard",
    children: [
      { name: "Analytics", path: "/analytics" },
      { name: "High Priority", path: "/high-priority" },
      { name: "Workflow & Approvals", path: "/workflow" },
      { name: "Documents", path: "/documents" },
      { name: "Communication", path: "/communication" },
    ]
  },
  {
    name: "Company Settings",
    path: "/settings/company",
    icon: SettingsIcon,
    module: "settings",
    children: [
      { name: "Company", path: "/settings/company" },
      { name: "Email (SMTP)", path: "/settings/company/email" },
      { name: "System Settings", path: "/settings" },
      { name: "Backup & Restore", path: "/backup" },
    ]
  },
];

export const Sidebar = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener("storage", onChange);
    window.addEventListener("company-settings-changed", onChange as EventListener);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("company-settings-changed", onChange as EventListener);
    };
  }, []);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const isModuleActive = (item: NavItem, currentPath: string): boolean => {
    if (item.children && item.children.length) {
      return item.children.some((c) => currentPath === c.path || currentPath.startsWith(c.path + "/") || currentPath === item.path);
    }
    if (item.path === "/") return currentPath === "/";
    return currentPath === item.path || currentPath.startsWith(item.path + "/");
  };

  useEffect(() => {
    // Auto-expand the active module based on route
    const active = navItems.find((it) => isModuleActive(it, pathname));
    setExpandedItem(active?.name ?? null);
  }, [pathname]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItem(prev => (prev === itemName ? null : itemName));
  };

  const moduleForPath = (path: string): ModuleKey | undefined => {
    if (path === "/" || path.startsWith("/zoom")) return "dashboard";
    if (
      path.startsWith("/analytics") ||
      path.startsWith("/high-priority") ||
      path.startsWith("/workflow") ||
      path.startsWith("/documents") ||
      path.startsWith("/communication")
    ) return "dashboard";
    if (path.startsWith("/backup")) return "settings";
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
    if (path.startsWith("/whatsapp")) return "whatsapp";
    return undefined;
  };

  const canSeePath = (path: string): boolean => {
    const mod = moduleForPath(path);
    if (!mod) return false;
    return canAccess(mod, "view");
  };

  const visibleChildren = (item: NavItem): { name: string; path: string }[] => {
    if (!item.children?.length) return [];
    return item.children.filter((c) => canSeePath(c.path));
  };

  const canSeeItem = (item: NavItem): boolean => {
    if (item.children?.length) {
      return visibleChildren(item).length > 0;
    }
    if (!item.module) return true;
    return canAccess(item.module, "view");
  };

  return (
    <aside className="w-60 bg-card border-r border-border h-screen sticky top-0 overflow-y-auto">
      <div className="p-6">
        <div className="flex flex-col items-center gap-2">
          {CompanySettingsStore.get().logoDataUrl ? (
            <img src={CompanySettingsStore.get().logoDataUrl} alt={CompanySettingsStore.get().name} className="w-20 h-20 object-contain border-0 bg-transparent" />
          ) : (
            <img src="/logo.svg" alt="Logo" className="w-20 h-20 object-contain border-0 bg-transparent" />
          )}
          <span className="font-extrabold text-xl tracking-tight text-center w-full truncate">{CompanySettingsStore.get().name || "Company"}</span>
        </div>
      </div>

      <nav className="p-4 space-y-1">
        {navItems.filter(canSeeItem).map((item) => (
          <div key={item.name}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpanded(item.name)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isModuleActive(item, pathname)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.name}</span>
                  {expandedItem === item.name ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {expandedItem === item.name && (
                  <div className="ml-8 mt-1 space-y-1">
                    {visibleChildren(item).map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        end
                        className={({ isActive }) =>
                          cn(
                            "block px-3 py-2 rounded-lg text-sm transition-colors",
                            isActive
                              ? "text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )
                        }
                      >
                        {child.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <NavLink
                to={item.path}
                end
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary"
                  )
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
};
