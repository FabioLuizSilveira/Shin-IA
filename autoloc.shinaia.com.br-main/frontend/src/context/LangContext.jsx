import React, { createContext, useContext, useState, useCallback } from "react";
import { translations } from "@/i18n/translations";
import { trackEvent } from "@/lib/api";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState("pt");

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === "pt" ? "en" : "pt";
      trackEvent("language_toggle", { label: next, locale: next });
      return next;
    });
  }, []);

  const t = translations[lang];

  return (
    <LangContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
