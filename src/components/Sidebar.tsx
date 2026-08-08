import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarNav } from "./SidebarNav";
import { CompanySettingsStore } from "@/lib/companySettings";

const COLLAPSE_KEY = "ui.sidebar.collapsed";

/** Company identity. The only place the brand is rendered in the app shell. */
export const BrandMark = ({ collapsed = false }: { collapsed?: boolean }) => {
  const [company, setCompany] = useState(() => CompanySettingsStore.get());

  useEffect(() => {
    const refresh = () => setCompany(CompanySettingsStore.get());
    window.addEventListener("company-settings-changed", refresh as EventListener);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("company-settings-changed", refresh as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const name = company.name || "Your Company";
  const logo = company.logoDataUrl || "/logo.svg";

  return (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-2.5 rounded-md px-1 py-1 transition-opacity duration-fast hover:opacity-80"
      aria-label={`${name} — go to dashboard`}
    >
      <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-sm object-contain" />
      {!collapsed && <span className="truncate text-sm font-semibold text-foreground">{name}</span>}
    </Link>
  );
};

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch { /* non-critical */ }
  }, [collapsed]);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex",
        "transition-[width] duration-normal ease-standard",
        collapsed ? "w-sidebar-collapsed" : "w-sidebar",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "justify-between gap-2",
        )}
      >
        <BrandMark collapsed={collapsed} />
      </div>

      <div className="scrollbar-subtle flex-1 overflow-y-auto">
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className={cn("border-t border-sidebar-border p-2", collapsed && "flex justify-center")}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};
