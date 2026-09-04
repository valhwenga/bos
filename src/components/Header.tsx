import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Search, UserCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { SettingsButton } from "./SettingsButton";
import { SidebarNav } from "./SidebarNav";
import { BrandMark } from "./Sidebar";
import { UserStore } from "@/lib/userStore";
import { AuthStore } from "@/lib/authStore";
import {
  NotificationsStore,
  notificationsCache,
  subscribeToNotifications,
} from "@/lib/notificationsStore";
import { useCache } from "@/lib/collectionCache";
import { getCurrentRole } from "@/lib/accessControl";
import { cn } from "@/lib/utils";

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const Header = () => {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Rows come from Postgres, so this re-renders when they arrive or change.
  useCache(notificationsCache);

  const profile = UserStore.get();
  // The signed-in account is the source of truth for identity; UserStore only
  // holds profile extras (avatar, department) and is empty for seeded accounts.
  const account = AuthStore.currentUser();
  const name = account?.name || profile.name || "User";
  const email = account?.email || profile.email;
  const role = getCurrentRole();

  const initials = useMemo(
    () => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
    [name],
  );

  useEffect(() => {
    if (!account?.id) return;
    // One arrives while you are on another screen. The focus refresh is the
    // safety net: a websocket that has quietly dropped would otherwise leave
    // the bell frozen, and not noticing it stopped is the failure mode here.
    const unsubscribe = subscribeToNotifications();
    const onFocus = () => void notificationsCache.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [account?.id]);

  const notifications = account?.id
    ? NotificationsStore.forUser(account.id).slice(0, 8)
    : [];
  const unread = notifications.filter((n) => !n.read).length;

  const signOut = async () => {
    try { UserStore.clockOut(); } catch { void 0; }
    // Await it: navigating first cancels the request that revokes the token.
    try { await AuthStore.signOut(); } catch { void 0; }
    navigate("/auth/login");
  };

  const openCommandPalette = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Mobile: the nav lives in a drawer instead of stealing 64% of the screen. */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open navigation">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b border-border px-4">
            <BrandMark />
          </div>
          <div className="scrollbar-subtle h-[calc(100vh-3.5rem)] overflow-y-auto">
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:hidden">
        <BrandMark />
      </div>

      <button
        type="button"
        onClick={openCommandPalette}
        className="ml-auto flex items-center gap-2 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-fast ease-standard hover:border-border-strong hover:text-foreground lg:ml-0 lg:mr-auto lg:w-64"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden lg:inline">Search…</span>
        <kbd className="ml-auto hidden rounded-xs border border-border bg-background px-1.5 py-0.5 font-mono text-2xs text-subtle lg:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium">Notifications</span>
              {unread > 0 && account?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void NotificationsStore.markAllRead(account.id)}
                >
                  Mark all read
                </Button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        void NotificationsStore.markRead(n.id);
                        if (n.link) navigate(n.link);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors duration-fast last:border-0 hover:bg-surface-raised",
                        !n.read && "bg-primary-soft/40",
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">{n.title}</span>
                      {n.description && (
                        <span className="line-clamp-2 text-xs text-muted-foreground">{n.description}</span>
                      )}
                      <span className="text-2xs text-subtle">{timeAgo(n.ts)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>

        <SettingsButton />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-1.5" aria-label="Account menu">
              <Avatar className="h-6 w-6">
                {profile.avatarDataUrl ? (
                  <img src={profile.avatarDataUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <AvatarFallback className="bg-primary text-2xs text-primary-foreground">{initials}</AvatarFallback>
                )}
              </Avatar>
              <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{name}</span>
              {email && <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>}
              <span className="mt-1 w-fit rounded-xs bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                {role.name}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/users/profile">
                <UserCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
