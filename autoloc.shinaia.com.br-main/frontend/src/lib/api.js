import axios from "axios";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

// Leads and analytics events are written straight to the Shinã Supabase via
// PostgREST. The anon key is public (role: anon); the landing_* tables are
// INSERT-only under RLS, so nothing can be read back with it.
const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

const clean = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

export async function trackEvent(event, meta = {}) {
  try {
    const { label, section, locale, value } = meta;
    await axios.post(
      `${REST}/landing_events`,
      clean({ event, label, section, locale, value }),
      { headers: HEADERS, timeout: 8000 },
    );
  } catch (e) {
    // analytics is best-effort, never block UX
  }
}

export async function submitLead(payload) {
  const { name, email, phone, profile, fleet_size, plan, source, locale } = payload;
  await axios.post(
    `${REST}/landing_leads`,
    clean({ name, email, phone, profile, fleet_size, plan, source, locale }),
    { headers: HEADERS, timeout: 12000 },
  );
  return { ok: true };
}
