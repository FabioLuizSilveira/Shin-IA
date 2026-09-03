import React, { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ArrowRight } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { submitLead, trackEvent } from "@/lib/api";
import { PLATFORM } from "@/lib/config";

const LeadContext = createContext(null);
export const useLead = () => useContext(LeadContext);

export function LeadProvider({ children }) {
  const { t, lang } = useLang();
  const m = t.modal;
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("cta");
  const [status, setStatus] = useState("idle");
  const [form, setForm] = useState({ name: "", email: "", phone: "", profile: "locador", fleet_size: "" });

  const openLead = (src = "cta") => {
    setSource(src);
    setStatus("idle");
    setOpen(true);
    trackEvent("form_started", { label: src, section: src, locale: lang });
  };

  const close = () => setOpen(false);
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await submitLead({ ...form, source, locale: lang });
      trackEvent("form_completed", { label: source, section: source, locale: lang });
      window.location.assign(PLATFORM.signup);
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <LeadContext.Provider value={{ openLead }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={close} />
            <motion.div
              data-testid="lead-modal"
              className="glass relative z-10 w-full max-w-md rounded-3xl p-8"
              initial={{ scale: 0.92, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <button data-testid="lead-modal-close" onClick={close} className="absolute right-5 top-5 text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>

              <h3 className="font-display text-2xl font-bold">{m.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{m.sub}</p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <input data-testid="lead-name" required value={form.name} onChange={upd("name")} placeholder={m.name}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#00E5FF]/60 transition-colors" />
                <input data-testid="lead-email" required type="email" value={form.email} onChange={upd("email")} placeholder={m.email}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#00E5FF]/60 transition-colors" />
                <input data-testid="lead-phone" value={form.phone} onChange={upd("phone")} placeholder={m.phone}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#00E5FF]/60 transition-colors" />
                <select data-testid="lead-fleet" required value={form.fleet_size} onChange={upd("fleet_size")}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#00E5FF]/60 transition-colors">
                  <option value="" disabled className="bg-[#3f3f52]">{m.fleet}</option>
                  <option value="ate_10" className="bg-[#3f3f52]">{m.fleet10}</option>
                  <option value="ate_50" className="bg-[#3f3f52]">{m.fleet50}</option>
                  <option value="mais_50" className="bg-[#3f3f52]">{m.fleet50p}</option>
                </select>
                {status === "error" && <p className="text-sm text-red-400">{m.error}</p>}
                <button data-testid="lead-submit" type="submit" disabled={status === "loading"}
                  className="btn-glow flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#7000FF] px-6 py-3.5 font-semibold text-white disabled:opacity-60">
                  {status === "loading" ? <Loader2 className="animate-spin" size={18} /> : <>{m.submit} <ArrowRight size={16} /></>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LeadContext.Provider>
  );
}
