import { Bell, Globe } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { SettingsButton } from "./SettingsButton";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserStore } from "@/lib/userStore";
import { NotificationsStore } from "@/lib/notificationsStore";
import { toast } from "./ui/use-toast";
import { AuthStore } from "@/lib/authStore";

export const Header = () => {
  const navigate = useNavigate();
  const user = UserStore.get();
  const [tick, setTick] = useState(0);
  const initials = useMemo(() => (user.name || "U").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase(), [user.name]);
  const onProfile = () => navigate("/users/profile");
  const onLogout = () => { try { AuthStore.signOut(); } catch {} try { UserStore.clockOut(); } catch {} navigate("/auth/login"); };
  const notifs = NotificationsStore.forUser(user.id);
  const unread = NotificationsStore.unreadCount(user.id);
  useEffect(() => {
    const onAny = () => setTick(t => t+1);
    const onNotify = (e: any) => {
      const n = e?.detail;
      if (n?.userId === user.id) {
        toast({ title: n.title, description: n.description });
        setTick(t => t+1);
      }
    };
    window.addEventListener("storage", onAny);
    window.addEventListener("app:notify", onNotify as EventListener);
    return () => {
      window.removeEventListener("storage", onAny);
      window.removeEventListener("app:notify", onNotify as EventListener);
    };
  }, [user.id]);
  return (
    <header className="h-16 border-b border-border bg-gradient-to-b from-card to-card/90 px-6 flex items-center justify-between sticky top-0 z-10 shadow-[0_6px_0_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or page title will be rendered here by pages */}
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">{unread}</span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="px-3 py-2 text-xs font-medium border-b">Notifications</div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">No notifications</div>
              )}
              {notifs.slice(0, 20).map(n => (
                <button key={n.id} className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-secondary ${n.read ? 'opacity-70' : ''}`} onClick={() => { if (n.link) navigate(n.link); NotificationsStore.markRead(n.id); setTick(t=>t+1); }}>
                  <div className="font-medium truncate">{n.title}</div>
                  {n.description && <div className="text-xs text-muted-foreground truncate">{n.description}</div>}
                  <div className="text-[10px] text-muted-foreground">{new Date(n.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
            {notifs.length > 0 && (
              <div className="p-2">
                <Button size="sm" variant="secondary" className="w-full" onClick={()=> { NotificationsStore.markAllRead(user.id); setTick(t=>t+1); }}>Mark all as read</Button>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Globe className="w-4 h-4" />
              <span>English</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>English</DropdownMenuItem>
            <DropdownMenuItem>Spanish</DropdownMenuItem>
            <DropdownMenuItem>French</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SettingsButton />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                {user.avatarDataUrl ? (
                  <img src={user.avatarDataUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
                )}
              </Avatar>
              <span className="text-sm font-medium">Hi, {user.name || "User"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onProfile}>Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={()=> navigate("/users/profile")}>Personal Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
