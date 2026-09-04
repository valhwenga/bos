import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";

/**
 * A deliberately small accent set. Each entry ships a matched pair for light
 * and dark grounds — a single hue can't serve both, which is why the previous
 * free-form hue slider produced unreadable combinations.
 *
 * Accents only ever drive --primary/--accent/--ring. Semantic status colours
 * (success, warning, danger, info) are fixed, so state never changes meaning
 * when someone picks a different accent.
 */
export type ThemePalette = "emerald" | "blue" | "violet" | "amber" | "slate";

type PaletteTokens = { primary: string; hover: string; soft: string; onPrimary: string };

const PALETTES: Record<ThemePalette, { light: PaletteTokens; dark: PaletteTokens }> = {
  emerald: {
    light: { primary: "164 76% 30%", hover: "164 76% 26%", soft: "164 44% 94%", onPrimary: "0 0% 100%" },
    dark: { primary: "162 62% 46%", hover: "162 62% 52%", soft: "164 40% 16%", onPrimary: "200 30% 8%" },
  },
  blue: {
    light: { primary: "217 78% 42%", hover: "217 78% 36%", soft: "217 70% 95%", onPrimary: "0 0% 100%" },
    dark: { primary: "213 82% 62%", hover: "213 82% 68%", soft: "215 44% 18%", onPrimary: "215 60% 10%" },
  },
  violet: {
    light: { primary: "262 62% 48%", hover: "262 62% 42%", soft: "262 62% 96%", onPrimary: "0 0% 100%" },
    dark: { primary: "262 72% 68%", hover: "262 72% 74%", soft: "262 38% 20%", onPrimary: "262 50% 10%" },
  },
  amber: {
    light: { primary: "28 78% 40%", hover: "28 78% 34%", soft: "36 78% 94%", onPrimary: "0 0% 100%" },
    dark: { primary: "38 78% 58%", hover: "38 78% 64%", soft: "36 36% 18%", onPrimary: "32 70% 10%" },
  },
  slate: {
    light: { primary: "205 28% 28%", hover: "205 28% 22%", soft: "205 24% 94%", onPrimary: "0 0% 100%" },
    dark: { primary: "205 18% 68%", hover: "205 18% 76%", soft: "205 14% 20%", onPrimary: "205 30% 10%" },
  },
};

export const PALETTE_LABELS: Record<ThemePalette, string> = {
  emerald: "Emerald",
  blue: "Blue",
  violet: "Violet",
  amber: "Amber",
  slate: "Graphite",
};

interface ThemeContextValue {
  mode: ThemeMode;
  palette: ThemePalette;
  setMode: (m: ThemeMode) => void;
  setPalette: (p: ThemePalette) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEYS = { mode: "ui.theme.mode", palette: "ui.theme.palette" };

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = readStored<ThemeMode | null>(STORAGE_KEYS.mode, null);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    const stored = readStored<ThemePalette>(STORAGE_KEYS.palette, "emerald");
    return stored in PALETTES ? stored : "emerald";
  });

  // One effect owns the DOM so mode and palette can never disagree — the
  // accent depends on which ground it lands on.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");

    const tokens = PALETTES[palette][mode];
    root.style.setProperty("--primary", tokens.primary);
    root.style.setProperty("--primary-hover", tokens.hover);
    root.style.setProperty("--primary-soft", tokens.soft);
    root.style.setProperty("--primary-foreground", tokens.onPrimary);
    root.style.setProperty("--accent", tokens.primary);
    root.style.setProperty("--accent-foreground", tokens.onPrimary);
    root.style.setProperty("--ring", tokens.primary);
    root.style.setProperty("--sidebar-primary", tokens.primary);
    root.style.setProperty("--sidebar-primary-foreground", tokens.onPrimary);
    root.style.setProperty("--sidebar-ring", tokens.primary);

    try {
      localStorage.setItem(STORAGE_KEYS.mode, mode);
      localStorage.setItem(STORAGE_KEYS.palette, palette);
    } catch { /* storage unavailable; theme still applies for this session */ }
  }, [mode, palette]);

  // Follow the OS only while the user hasn't chosen for themselves.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEYS.mode)) setModeState(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setPalette = useCallback((p: ThemePalette) => setPaletteState(p), []);
  const toggleMode = useCallback(() => setModeState((prev) => (prev === "light" ? "dark" : "light")), []);

  const value = useMemo(
    () => ({ mode, palette, setMode, setPalette, toggleMode }),
    [mode, palette, setMode, setPalette, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
