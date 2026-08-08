import React from "react";
import { Settings, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTheme, PALETTE_LABELS, type ThemePalette } from "./theme/ThemeProvider";
import { getCurrentRole } from "@/lib/accessControl";

/**
 * Swatches preview the accent on the ground it will actually be used on, so
 * the choice is made against what the user will see.
 */
const SWATCH_CLASS: Record<ThemePalette, string> = {
  emerald: "bg-[hsl(164_76%_30%)] dark:bg-[hsl(162_62%_46%)]",
  blue: "bg-[hsl(217_78%_42%)] dark:bg-[hsl(213_82%_62%)]",
  violet: "bg-[hsl(262_62%_48%)] dark:bg-[hsl(262_72%_68%)]",
  amber: "bg-[hsl(28_78%_40%)] dark:bg-[hsl(38_78%_58%)]",
  slate: "bg-[hsl(205_28%_28%)] dark:bg-[hsl(205_18%_68%)]",
};

export const SettingsButton: React.FC = () => {
  const { mode, toggleMode, palette, setPalette } = useTheme();
  const role = getCurrentRole();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
          <DialogDescription>
            These settings apply to your account on this device only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 pt-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="theme-mode">Dark mode</Label>
              <span className="text-xs text-muted-foreground">Follows your system until you choose.</span>
            </div>
            <Switch id="theme-mode" checked={mode === "dark"} onCheckedChange={toggleMode} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Accent colour</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
              {(Object.keys(PALETTE_LABELS) as ThemePalette[]).map((key) => {
                const selected = palette === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={PALETTE_LABELS[key]}
                    onClick={() => setPalette(key)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-fast ease-standard",
                      selected
                        ? "border-primary bg-primary-soft text-foreground"
                        : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    <span className={cn("h-3.5 w-3.5 rounded-full", SWATCH_CLASS[key])} aria-hidden="true" />
                    {PALETTE_LABELS[key]}
                    {selected && <Check className="h-3 w-3 text-primary" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/*
            This panel previously let anyone reassign their own role. Access is
            granted by an administrator under User Management, so the role is
            shown here as information only.
          */}
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">Your role</span>
              <span className="text-xs text-muted-foreground">Contact an administrator to change this.</span>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {role.name}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
