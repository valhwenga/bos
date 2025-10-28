import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";
export type ThemePalette =
  | "emerald"
  | "blue"
  | "violet"
  | "rose"
  | "amber"
  | "teal"
  | "cyan"
  | "indigo"
  | "orange"
  | "lime"
  | "fuchsia"
  | "slate";
export type ThemeFont = "Inter" | "Poppins" | "Rubik" | "Montserrat" | "Nunito" | "Source Sans 3";

interface ThemeContextValue {
  mode: ThemeMode;
  palette: ThemePalette;
  font: ThemeFont;
  hue: number; // 0-360 overrides palette if set
  setMode: (m: ThemeMode) => void;
  setPalette: (p: ThemePalette) => void;
  setFont: (f: ThemeFont) => void;
  setHue: (h: number) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const PALETTES: Record<ThemePalette, { primary: string; accent: string; ring: string }>= {
  emerald: { primary: "165 100% 36%", accent: "165 100% 36%", ring: "165 100% 36%" },
  blue: { primary: "217 91% 60%", accent: "217 91% 60%", ring: "217 91% 60%" },
  violet: { primary: "262 83% 58%", accent: "262 83% 58%", ring: "262 83% 58%" },
  rose: { primary: "347 77% 50%", accent: "347 77% 50%", ring: "347 77% 50%" },
  amber: { primary: "38 92% 50%", accent: "38 92% 50%", ring: "38 92% 50%" },
  teal: { primary: "173 73% 39%", accent: "173 73% 39%", ring: "173 73% 39%" },
  cyan: { primary: "191 94% 43%", accent: "191 94% 43%", ring: "191 94% 43%" },
  indigo: { primary: "239 84% 67%", accent: "239 84% 67%", ring: "239 84% 67%" },
  orange: { primary: "21 90% 54%", accent: "21 90% 54%", ring: "21 90% 54%" },
  lime: { primary: "84 81% 45%", accent: "84 81% 45%", ring: "84 81% 45%" },
  fuchsia: { primary: "292 86% 59%", accent: "292 86% 59%", ring: "292 86% 59%" },
  slate: { primary: "215 20% 50%", accent: "215 20% 50%", ring: "215 20% 50%" },
};

const STORAGE_KEYS = {
  mode: "ui.theme.mode",
  palette: "ui.theme.palette",
  font: "ui.theme.font",
  hue: "ui.theme.hue",
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }>= ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => (localStorage.getItem(STORAGE_KEYS.mode) as ThemeMode) || "light");
  const [palette, setPaletteState] = useState<ThemePalette>(() => (localStorage.getItem(STORAGE_KEYS.palette) as ThemePalette) || "emerald");
  const [font, setFontState] = useState<ThemeFont>(() => (localStorage.getItem(STORAGE_KEYS.font) as ThemeFont) || "Inter");
  const [hue, setHueState] = useState<number>(() => {
    const v = localStorage.getItem(STORAGE_KEYS.hue);
    return v ? Number(v) : 0;
  });

  const applyMode = useCallback((m: ThemeMode) => {
    const root = document.documentElement;
    root.classList.toggle("dark", m === "dark");
  }, []);

  const applyPalette = useCallback((p: ThemePalette) => {
    const root = document.documentElement;
    const { primary, accent, ring } = PALETTES[p];
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--ring", ring);
  }, []);

  const applyHue = useCallback((h: number) => {
    if (!h) return; // 0 means disabled, keep palette
    const root = document.documentElement;
    const primary = `${h} 86% 52%`;
    const accent = `${h} 86% 52%`;
    const ring = `${h} 86% 52%`;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--ring", ring);
  }, []);

  const applyFont = useCallback((f: ThemeFont) => {
    const root = document.documentElement;
    const fontValue = f.includes(" ") ? `"${f}"` : f;
    root.style.setProperty("--font-sans", fontValue);
  }, []);

  useEffect(() => {
    applyMode(mode);
    localStorage.setItem(STORAGE_KEYS.mode, mode);
  }, [mode, applyMode]);

  useEffect(() => {
    applyPalette(palette);
    localStorage.setItem(STORAGE_KEYS.palette, palette);
  }, [palette, applyPalette]);

  useEffect(() => {
    if (hue) {
      applyHue(hue);
    } else {
      applyPalette(palette);
    }
    localStorage.setItem(STORAGE_KEYS.hue, String(hue));
  }, [hue, palette, applyHue, applyPalette]);

  useEffect(() => {
    applyFont(font);
    localStorage.setItem(STORAGE_KEYS.font, font);
  }, [font, applyFont]);

  useEffect(() => {
    // initial sync on mount
    applyMode(mode);
    applyPalette(palette);
    if (hue) applyHue(hue);
    applyFont(font);
  }, []);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setPalette = useCallback((p: ThemePalette) => setPaletteState(p), []);
  const setFont = useCallback((f: ThemeFont) => setFontState(f), []);
  const setHue = useCallback((h: number) => setHueState(h), []);
  const toggleMode = useCallback(() => setModeState((prev) => (prev === "light" ? "dark" : "light")), []);

  const value = useMemo(() => ({ mode, palette, font, hue, setMode, setPalette, setFont, setHue, toggleMode }), [mode, palette, font, hue, setMode, setPalette, setFont, setHue, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
