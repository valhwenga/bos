import React from "react";
import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTheme, ThemePalette, ThemeFont } from "./theme/ThemeProvider";
import { Slider } from "@/components/ui/slider";
import { Permissions, type Role } from "@/lib/permissions";

export const SettingsButton: React.FC = () => {
  const { mode, toggleMode, palette, setPalette, font, setFont, hue, setHue } = useTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open settings">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>System Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select defaultValue={Permissions.getRole()} onValueChange={(v)=> Permissions.setRole(v as Role)}>
              <SelectTrigger aria-label="Select role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="theme-mode">Dark mode</Label>
            <Switch id="theme-mode" checked={mode === "dark"} onCheckedChange={toggleMode} />
          </div>
          <div className="grid gap-2">
            <Label>Accent color</Label>
            <Select value={palette} onValueChange={(v) => setPalette(v as ThemePalette)}>
              <SelectTrigger aria-label="Select accent color">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emerald">Emerald</SelectItem>
                <SelectItem value="blue">Blue</SelectItem>
                <SelectItem value="violet">Violet</SelectItem>
                <SelectItem value="rose">Rose</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Primary hue (optional)</Label>
            <Slider value={[hue || 0]} min={0} max={360} step={1} onValueChange={(v)=> setHue(v[0] ?? 0)} />
            <div className="text-xs text-muted-foreground">{hue ? `${hue}°` : "Disabled (using palette)"}</div>
          </div>
          <div className="grid gap-2">
            <Label>Font</Label>
            <Select value={font} onValueChange={(v)=> setFont(v as ThemeFont)}>
              <SelectTrigger aria-label="Select font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter">Inter</SelectItem>
                <SelectItem value="Poppins">Poppins</SelectItem>
                <SelectItem value="Rubik">Rubik</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
