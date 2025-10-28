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
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanySettingsStore } from "@/lib/companySettings";
import { useEffect, useState } from "react";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  children?: { name: string; path: string }[];
}

const navItems: NavItem[] = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { 
    name: "HRM System", 
    path: "/hrm", 
    icon: Users,
    children: [
      { name: "Employees", path: "/hrm/employees" },
      { name: "Departments", path: "/hrm/departments" },
      { name: "Attendance", path: "/hrm/attendance" },
      { name: "Leave", path: "/hrm/leave" },
      { name: "Payroll", path: "/hrm/payroll" },
      { name: "Performance", path: "/hrm/performance" },
    ]
  },
  { 
    name: "Accounting System", 
    path: "/accounting", 
    icon: Calculator,
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
    children: [
      { name: "User", path: "/users" },
      { name: "Role", path: "/users/role" },
      { name: "Client", path: "/users/client" },
    ]
  },
  { name: "Products System", path: "/products", icon: ShoppingCart },
  { name: "POS System", path: "/pos", icon: CreditCard },
  { 
    name: "Support System", 
    path: "/support", 
    icon: Headphones,
    children: [
      { name: "Dashboard", path: "/support" },
      { name: "Tickets", path: "/support/tickets" },
      { name: "Settings", path: "/support/settings" },
    ]
  },
  { name: "Zoom Meeting", path: "/zoom", icon: Video },
  { name: "Messenger", path: "/messenger", icon: MessageSquare },
  { 
    name: "WhatsApp", 
    path: "/whatsapp", 
    icon: MessageSquare,
    children: [
      { name: "Console", path: "/whatsapp" },
      { name: "Settings", path: "/whatsapp/settings" },
    ]
  },
  {
    name: "CRM",
    path: "/crm",
    icon: Users,
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
    children: [
      { name: "Inbox", path: "/email" },
      { name: "Sent", path: "/email/sent" },
      { name: "Compose", path: "/email/compose" },
    ]
  },
  { 
    name: "Company Settings", 
    path: "/settings/company", 
    icon: SettingsIcon,
    children: [
      { name: "Company", path: "/settings/company" },
      { name: "Email (SMTP)", path: "/settings/company/email" },
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

  return (
    <aside className="w-60 bg-card border-r border-border h-screen sticky top-0 overflow-y-auto shadow-[8px_0_0_rgba(0,0,0,0.04)]">
      <div className="p-6 border-b border-border">
        <div className="flex flex-col items-center gap-2">
          {CompanySettingsStore.get().logoDataUrl ? (
            <img src={CompanySettingsStore.get().logoDataUrl} alt={CompanySettingsStore.get().name} className="w-20 h-20 object-contain" />
          ) : (
            <img src="/logo.svg" alt="Logo" className="w-20 h-20 object-contain" />
          )}
          <span className="font-extrabold text-xl tracking-tight text-center w-full truncate">{CompanySettingsStore.get().name || "Company"}</span>
        </div>
      </div>

      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <div key={item.name}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpanded(item.name)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-[0_4px_0_rgba(0,0,0,0.06)]",
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
                    {item.children.map((child) => (
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-[0_4px_0_rgba(0,0,0,0.06)]",
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
