"use client";

// Theme Provider + Context (doc 09 §5). Aplica data-theme/data-product no
// documento, injeta as CSS variables e persiste a escolha do usuário.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createTheme, type ShinaTheme, type ThemeMode, type ThemeProduct } from "@shina/tokens";
import { themeToCssVariables } from "./css-variables";

export type ThemePreference = ThemeMode | "auto";

interface ThemeContextValue {
  theme: ShinaTheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  product: ThemeProduct;
}

const STORAGE_KEY = "shina-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: createTheme(),
  preference: "dark",
  setPreference: () => {},
  product: "platform",
});

function resolveMode(preference: ThemePreference): ThemeMode {
  if (preference !== "auto") return preference;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function ShinaThemeProvider({
  children,
  product = "platform",
  defaultPreference = "dark",
}: {
  children: ReactNode;
  product?: ThemeProduct;
  defaultPreference?: ThemePreference;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(defaultPreference);
  const [mode, setMode] = useState<ThemeMode>(() => resolveMode(defaultPreference));

  // hydrate stored preference
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (stored === "dark" || stored === "light" || stored === "auto") {
        setPreferenceState(stored);
        setMode(resolveMode(stored));
      }
    } catch {
      // storage indisponível (modo privado) — segue o default
    }
  }, []);

  // follow system when auto
  useEffect(() => {
    if (preference !== "auto" || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setMode(resolveMode("auto"));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const theme = useMemo(() => createTheme({ mode, product }), [mode, product]);

  // apply data attributes + css variables to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme.mode;
    root.dataset.product = product;
    root.classList.toggle("dark", theme.mode === "dark");
    for (const [key, value] of Object.entries(themeToCssVariables(theme))) {
      root.style.setProperty(key, value);
    }
  }, [theme, product]);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    setMode(resolveMode(next));
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  const value = useMemo(
    () => ({ theme, preference, setPreference, product }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, preference, product],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useShinaTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
