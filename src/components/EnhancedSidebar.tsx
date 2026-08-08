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
  ChevronDown,
  TrendingUp,
  Building,
  FileText,
  Package,
  BarChart3,
  Calendar,
  Zap,
  Shield,
  Database,
  Globe,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanySettingsStore } from "@/lib/companySettings";
import { useEffect, useState } from "react";
import { canAccess } from "@/lib/accessControl";
import type { ModuleKey } from "@/lib/rolesStore";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  children?: { name: string; path: string; icon?: React.ElementType }[];
  module?: ModuleKey;
  badge?: string;
  description?: string;
  category?: string;
}

const navItems: NavItem[] = [
  { 
    name: "Dashboard", 
    path: "/", 
    icon: LayoutDashboard, 
    module: "dashboard",
    description: "Overview & Analytics",
    badge: "New"
  },
  { 
    name: "HRM System", 
    path: "/hrm", 
    icon: Users,
    module: "hrm.employees",
    description: "Human Resources",
    category: "Management",
    children: [
      { name: "Employees", path: "/hrm/employees", icon: Users },
      { name: "Departments", path: "/hrm/departments", icon: Building },
      { name: "Attendance", path: "/hrm/attendance", icon: Calendar },
      { name: "Leave", path: "/hrm/leave", icon: FileText },
      { name: "Payroll", path: "/hrm/payroll", icon: CreditCard },
      { name: "Performance", path: "/hrm/performance", icon: TrendingUp },
    ]
  },
  { 
    name: "Accounting", 
    path: "/accounting", 
    icon: Calculator,
    module: "accounting",
    description: "Financial Management",
    category: "Finance",
    children: [
      { name: "Invoices", path: "/accounting/invoices", icon: FileText },
      { name: "Customers", path: "/accounting/customers", icon: Users },
      { name: "Products", path: "/accounting/products", icon: Package },
      { name: "Payments", path: "/accounting/payments", icon: CreditCard },
      { name: "Reports", path: "/accounting/reports", icon: BarChart3 },
    ]
  },
  { 
    name: "Projects", 
    path: "/projects", 
    icon: FolderKanban,
    module: "projects",
    description: "Project Management",
    category: "Management",
    children: [
      { name: "All Projects", path: "/projects", icon: FolderKanban },
      { name: "Tasks", path: "/projects/tasks", icon: Calendar },
      { name: "Timesheet", path: "/projects/timesheet", icon: Clock },
      { name: "Reports", path: "/projects/report", icon: BarChart3 },
    ]
  },
  { 
    name: "Communication", 
    path: "/communication", 
    icon: MessageSquare,
    module: "messenger",
    description: "Messages & Chat",
    badge: "3",
    children: [
      { name: "Messages", path: "/communication", icon: MessageSquare },
      { name: "Meetings", path: "/zoom", icon: Video },
    ]
  },
  { 
    name: "Support", 
    path: "/support", 
    icon: Headphones,
    module: "support",
    description: "Customer Support",
    category: "Service",
    children: [
      { name: "Tickets", path: "/support/tickets", icon: Headphones },
      { name: "Dashboard", path: "/support", icon: LayoutDashboard },
    ]
  },
  { 
    name: "CRM", 
    path: "/crm", 
    icon: Users,
    module: "crm",
    description: "Customer Relations",
    category: "Sales",
    children: [
      { name: "Leads", path: "/crm/leads", icon: TrendingUp },
      { name: "Customers", path: "/crm/customers", icon: Users },
      { name: "Deals", path: "/crm/deals", icon: Handshake },
    ]
  },
  { 
    name: "Inventory", 
    path: "/products", 
    icon: Package,
    module: "inventory",
    description: "Stock & Products",
    category: "Operations",
    children: [
      { name: "Products", path: "/products", icon: Package },
      { name: "POS System", path: "/pos", icon: CreditCard },
    ]
  },
  { 
    name: "Settings", 
    path: "/settings/company", 
    icon: SettingsIcon,
    module: "settings",
    description: "System Configuration",
    category: "System",
    children: [
      { name: "Company", path: "/settings/company", icon: Building },
      { name: "Users", path: "/users", icon: Users },
      { name: "Roles", path: "/users/role", icon: Shield },
    ]
  },
];

export const EnhancedSidebar = () => {
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
    // Auto-expand active module based on route
    const active = navItems.find((it) => isModuleActive(it, pathname));
    setExpandedItem(active?.name ?? null);
  }, [pathname]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItem(prev => (prev === itemName ? null : itemName));
  };

  const moduleForPath = (path: string): ModuleKey | undefined => {
    if (path === "/" || path.startsWith("/zoom")) return "dashboard";
    if (path.startsWith("/hrm")) return "hrm.employees";
    if (path.startsWith("/accounting")) return "accounting";
    if (path.startsWith("/projects")) return "projects";
    if (path.startsWith("/crm")) return "crm";
    if (path.startsWith("/support")) return "support";
    if (path.startsWith("/products") || path.startsWith("/pos")) return "inventory";
    if (path.startsWith("/users") || path.startsWith("/settings")) return "settings";
    if (path.startsWith("/communication")) return "messenger";
    return undefined;
  };

  const canSeePath = (path: string): boolean => {
    const mod = moduleForPath(path);
    if (!mod) return false;
    return canAccess(mod, "view");
  };

  const visibleChildren = (item: NavItem): { name: string; path: string; icon?: React.ElementType }[] => {
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

  const getIconBackground = (itemName: string, isActive: boolean) => {
    const iconColors: { [key: string]: string } = {
      "Dashboard": isActive ? "bg-blue-500" : "bg-blue-100",
      "HRM System": isActive ? "bg-green-500" : "bg-green-100", 
      "Accounting": isActive ? "bg-purple-500" : "bg-purple-100",
      "Projects": isActive ? "bg-orange-500" : "bg-orange-100",
      "Communication": isActive ? "bg-cyan-500" : "bg-cyan-100",
      "Support": isActive ? "bg-red-500" : "bg-red-100",
      "CRM": isActive ? "bg-indigo-500" : "bg-indigo-100",
      "Inventory": isActive ? "bg-yellow-500" : "bg-yellow-100",
      "Settings": isActive ? "bg-gray-500" : "bg-gray-100",
    };
    return iconColors[itemName] || (isActive ? "bg-primary" : "bg-gray-100");
  };

  const getIconColor = (itemName: string, isActive: boolean) => {
    const iconColors: { [key: string]: string } = {
      "Dashboard": isActive ? "text-white" : "text-blue-600",
      "HRM System": isActive ? "text-white" : "text-green-600", 
      "Accounting": isActive ? "text-white" : "text-purple-600",
      "Projects": isActive ? "text-white" : "text-orange-600",
      "Communication": isActive ? "text-white" : "text-cyan-600",
      "Support": isActive ? "text-white" : "text-red-600",
      "CRM": isActive ? "text-white" : "text-indigo-600",
      "Inventory": isActive ? "text-white" : "text-yellow-600",
      "Settings": isActive ? "text-white" : "text-gray-600",
    };
    return iconColors[itemName] || (isActive ? "text-primary-foreground" : "text-gray-600");
  };

  return (
    <aside className="w-72 bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto shadow-xl">
      {/* Header Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Building className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg text-gray-900 truncate">
              {CompanySettingsStore.get().name || "SpikeTech"}
            </h1>
            <p className="text-xs text-gray-500">Business Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {navItems.filter(canSeeItem).map((item) => (
          <div key={item.name}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpanded(item.name)}
                  className={cn(
                    "w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    "hover:bg-gray-50 hover:shadow-sm",
                    isModuleActive(item, pathname)
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm"
                      : "border border-transparent"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
                    getIconBackground(item.name, isModuleActive(item, pathname))
                  )}>
                    <item.icon className={cn(
                      "w-5 h-5 transition-all duration-200",
                      getIconColor(item.name, isModuleActive(item, pathname))
                    )} />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-semibold text-sm transition-all duration-200",
                        isModuleActive(item, pathname) ? "text-gray-900" : "text-gray-700 group-hover:text-gray-900"
                      )}>
                        {item.name}
                      </span>
                      {item.badge && (
                        <Badge variant={isModuleActive(item, pathname) ? "default" : "secondary"} className="text-xs px-2 py-1 h-5">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                    )}
                  </div>
                  
                  <div className={cn(
                    "transition-all duration-200",
                    isModuleActive(item, pathname) ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                  )}>
                    {expandedItem === item.name ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>
                
                {expandedItem === item.name && (
                  <div className="ml-14 mt-2 space-y-1">
                    {visibleChildren(item).map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        end
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                            "hover:bg-gray-50 hover:text-gray-900",
                            isActive
                              ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-500"
                              : "text-gray-600"
                          )
                        }
                      >
                        {child.icon && (
                          <child.icon className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                        )}
                        <span className="flex-1">{child.name}</span>
                        {isActive && (
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <NavLink
                to={item.path}
                end
                className={({ isActive: active }) =>
                  cn(
                    "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    "hover:bg-gray-50 hover:shadow-sm",
                    active
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm"
                      : "border border-transparent"
                  )
                }
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
                  getIconBackground(item.name, active)
                )}>
                  <item.icon className={cn(
                    "w-5 h-5 transition-all duration-200",
                    getIconColor(item.name, active)
                  )} />
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-semibold text-sm transition-all duration-200",
                      active ? "text-gray-900" : "text-gray-700 group-hover:text-gray-900"
                    )}>
                      {item.name}
                    </span>
                    {item.badge && (
                      <Badge variant={active ? "default" : "secondary"} className="text-xs px-2 py-1 h-5">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                  )}
                </div>
                
                {active && (
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                )}
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-900">Pro Plan</p>
            <p className="text-xs text-gray-500">All features unlocked</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
