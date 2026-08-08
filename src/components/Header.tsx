import { useState, useMemo } from "react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { SettingsButton } from "./SettingsButton";
import { useNavigate } from "react-router-dom";
import { UserStore } from "@/lib/userStore";
import { AuthStore } from "@/lib/authStore";

export const Header = () => {
  const navigate = useNavigate();
  const profile = UserStore.get();
  // The signed-in account is the source of truth for identity; UserStore only
  // holds profile extras (avatar, department) and is empty for seeded accounts,
  // which is why this used to render "Hi, User" for everyone.
  const account = AuthStore.currentUser();
  const user = { ...profile, name: account?.name || profile.name, email: account?.email || profile.email };
  const initials = useMemo(() => (user.name || "U").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase(), [user.name]);
  const onProfile = () => navigate("/users/profile");
  const onLogout = () => { try { AuthStore.signOut(); } catch { void 0; } try { UserStore.clockOut(); } catch { void 0; } navigate("/auth/login"); };

  return (
    <header className="bg-background border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">Spike Tech</h1>
        <p className="text-muted-foreground">Business Management System</p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onProfile}>
          <Avatar className="w-8 h-8">
            {user.avatarDataUrl ? (
              <img src={user.avatarDataUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
            )}
          </Avatar>
          <span className="text-sm font-medium">Hi, {user.name || "User"}</span>
        </Button>

        <SettingsButton />
      </div>
    </header>
  );
};
