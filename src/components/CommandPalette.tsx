import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus, LogOut, Moon, Sun, UserCircle } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { searchableDestinations, canSeePath } from "@/lib/navigation";
import { useTheme } from "./theme/ThemeProvider";
import { AuthStore } from "@/lib/authStore";
import { UserStore } from "@/lib/userStore";

/**
 * Keyboard-first navigation. Only shows destinations the current role can
 * actually reach, so it can't advertise pages that would be denied.
 */
export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { mode, toggleMode } = useTheme();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Recomputed per open so a role change mid-session is reflected.
  const grouped = useMemo(() => {
    const groups = new Map<string, ReturnType<typeof searchableDestinations>>();
    for (const dest of searchableDestinations()) {
      const list = groups.get(dest.group) ?? [];
      list.push(dest);
      groups.set(dest.group, list);
    }
    return [...groups.entries()];
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Actions">
          {canSeePath("/accounting/invoices") && (
            <CommandItem onSelect={() => run(() => navigate("/accounting/invoices"))}>
              <FilePlus className="mr-2 h-4 w-4" aria-hidden="true" />
              New invoice
            </CommandItem>
          )}
          <CommandItem onSelect={() => run(toggleMode)}>
            {mode === "dark" ? (
              <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Switch to {mode === "dark" ? "light" : "dark"} mode
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/users/profile"))}>
            <UserCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Your profile
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                try { AuthStore.signOut(); } catch { void 0; }
                try { UserStore.clockOut(); } catch { void 0; }
                navigate("/auth/login");
              })
            }
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign out
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {grouped.map(([group, destinations]) => (
          <CommandGroup key={group} heading={group}>
            {destinations.map((dest) => {
              const Icon = dest.icon;
              return (
                <CommandItem
                  key={dest.path}
                  value={`${group} ${dest.name} ${dest.path}`}
                  onSelect={() => run(() => navigate(dest.path))}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {dest.name}
                  <CommandShortcut>{dest.path}</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};
