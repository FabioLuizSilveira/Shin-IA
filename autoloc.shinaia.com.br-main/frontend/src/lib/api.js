import axios from "axios";

// REACT_APP_BACKEND_URL is baked at build time; fall back to the deployed
// backend so production doesn't hit "/undefined/api" when the env var is unset.
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "https://backend-mu-mocha-91.vercel.app";
const API = `${BACKEND_URL.replace(/\/$/, "")}/api`;

export async function trackEvent(event, meta = {}) {
  try {
    await axios.post(`${API}/events`, { event, ...meta });
  } catch (e) {
    // analytics is best-effort, never block UX
  }
}

export async function submitLead(payload) {
  const { data } = await axios.post(`${API}/leads`, payload);
  return data;
}
