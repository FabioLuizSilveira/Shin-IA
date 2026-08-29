import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
