import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isItemActive, visibleChildren, visibleNav, type NavItem } from "@/lib/navigation";

interface SidebarNavProps {
  /** Icon-only rail. Ignored on mobile, where there is always room for labels. */
  collapsed?: boolean;
  /** Called after any navigation, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

export const SidebarNav = ({ collapsed = false, onNavigate }: SidebarNavProps) => {
  const { pathname } = useLocation();
  const items = visibleNav();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Open the group containing the current route, so where you are is visible
  // without hunting. Only one group stays open at a time.
  useEffect(() => {
    const active = items.find((item) => isItemActive(item, pathname));
    setExpanded(active?.name ?? null);
    // `items` is derived from the route + role and is stable enough to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const linkBase =
    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-fast ease-standard";

  const renderItem = (item: NavItem) => {
    const children = visibleChildren(item);
    const active = isItemActive(item, pathname);
    const Icon = item.icon;

    if (collapsed) {
      // Collapsed rail: the whole group becomes one icon that routes to its
      // first reachable destination, with the name in a tooltip.
      const target = children[0]?.path ?? item.path;
      return (
        <Tooltip key={item.name} delayDuration={0}>
          <TooltipTrigger asChild>
            <NavLink
              to={target}
              onClick={onNavigate}
              aria-label={item.name}
              className={cn(
                linkBase,
                "justify-center px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{item.name}</TooltipContent>
        </Tooltip>
      );
    }

    if (!children.length) {
      return (
        <NavLink
          key={item.name}
          to={item.path}
          end={item.path === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              linkBase,
              isActive
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.name}</span>
        </NavLink>
      );
    }

    const open = expanded === item.name;
    return (
      <div key={item.name}>
        <button
          type="button"
          onClick={() => setExpanded((prev) => (prev === item.name ? null : item.name))}
          aria-expanded={open}
          className={cn(
            linkBase,
            "w-full text-left",
            active
              ? "font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">{item.name}</span>
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-subtle transition-transform duration-fast ease-standard",
              open && "rotate-90",
            )}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
            {/* Rail ties the children back to their parent group. */}
            <div className="flex flex-col gap-0.5 border-l border-sidebar-border pl-2.5">
              {children.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "truncate rounded-md px-2.5 py-1.5 text-sm transition-colors duration-fast ease-standard",
                      isActive
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )
                  }
                >
                  {child.name}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="flex flex-col gap-0.5 p-2" aria-label="Main">
      {items.map(renderItem)}
    </nav>
  );
};
