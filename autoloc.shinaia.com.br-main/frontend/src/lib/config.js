// Existing Shinã platform endpoints. Replace with the production URLs when available.
// The landing page does NOT own auth — these route users into the existing platform.
export const PLATFORM = {
  login: "https://app.shinaia.com.br/login",
  signup: "https://app.shinaia.com.br/login",
  // ProductDemo "Ver como…" CTAs — the platform has no one-click demo URL,
  // so each tab points at its own entry: staff login vs the customer portal.
  demoTeam: "https://app.shinaia.com.br/login",
  demoCustomer: "https://app.shinaia.com.br/rentals",
};

// WhatsApp do especialista. Troque pelo número real (formato internacional, só dígitos).
export const WHATSAPP = {
  number: "5511966289405",
  message: {
    pt: "Olá! Quero falar com um especialista sobre a Shinã I.A.",
    en: "Hi! I'd like to talk to a specialist about Shinã I.A.",
  },
};

export const BRAND_LOGO = "/shina-mark.png";

// Shinã hosted Supabase — leads and analytics are written straight to PostgREST.
// The anon key is public by design (role: anon) and locked down by RLS: the
// landing_* tables allow INSERT only, no reads. See supabase migration
// 20260831000000_landing_lead_capture.sql in the Shinã monorepo.
export const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || "https://wokoqmoulsvzikkdcmfc.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indva29xbW91bHN2emlra2RjbWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTg5MzQsImV4cCI6MjA5Nzg5NDkzNH0.ooIrP6ruo95JkSay9N_IAnr6XDQU7hgs_YPBmU_F9js";
