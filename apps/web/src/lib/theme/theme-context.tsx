"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("shina-theme") as Theme | null;
      const prefersDark =
        typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : false;
      const preferred = stored ?? (prefersDark ? "dark" : "light");
      setTheme(preferred);
      document.documentElement.classList.toggle("dark", preferred === "dark");
    } catch {
      // localStorage unavailable (private mode or restrictive context)
    }
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem("shina-theme", next);
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
