import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LangContext";
import { WHATSAPP } from "@/lib/config";
import { trackEvent } from "@/lib/api";

export function FloatingWhatsApp() {
  const { t, lang } = useLang();
  const label = t.final.ctaSecondary;

  const open = () => {
    trackEvent("cta_click", { label: "whatsapp_float", section: "floating", locale: lang });
    const msg = encodeURIComponent(WHATSAPP.message[lang] || WHATSAPP.message.pt);
    window.open(`https://wa.me/${WHATSAPP.number}?text=${msg}`, "_blank", "noopener");
  };

  return (
    <motion.button
      data-testid="whatsapp-float"
      onClick={open}
      aria-label={label}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.4, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className="group fixed bottom-6 right-6 z-[90] flex items-center gap-3 rounded-full bg-[#25D366] py-3.5 pl-4 pr-4 shadow-[0_10px_40px_rgba(37,211,102,0.45)] md:pr-5"
    >
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-40" />
      <svg viewBox="0 0 32 32" width="26" height="26" fill="#fff" aria-hidden="true">
        <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.257.593 4.46 1.72 6.4L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.233 1.588h.005c7.06 0 12.8-5.74 12.8-12.8s-5.74-12.668-12.805-12.668zm0 23.03h-.004a10.61 10.61 0 0 1-5.406-1.48l-.388-.23-4.006 1.05 1.07-3.905-.253-.4a10.57 10.57 0 0 1-1.62-5.635c0-5.86 4.77-10.63 10.638-10.63 2.84 0 5.51 1.107 7.52 3.117a10.56 10.56 0 0 1 3.113 7.52c0 5.86-4.77 10.63-10.636 10.63zm5.83-7.96c-.32-.16-1.89-.933-2.183-1.04-.293-.107-.507-.16-.72.16-.213.32-.826 1.04-1.013 1.253-.187.213-.373.24-.693.08-.32-.16-1.35-.498-2.57-1.586-.95-.847-1.59-1.893-1.777-2.213-.187-.32-.02-.493.14-.653.144-.143.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.735-.986-2.375-.26-.624-.524-.54-.72-.55l-.613-.01c-.213 0-.56.08-.853.4-.293.32-1.12 1.093-1.12 2.667s1.146 3.093 1.306 3.307c.16.213 2.253 3.44 5.46 4.826.763.33 1.36.527 1.824.674.767.244 1.464.21 2.016.127.615-.092 1.89-.773 2.157-1.52.267-.747.267-1.387.187-1.52-.08-.133-.293-.213-.613-.373z"/>
      </svg>
      <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-white transition-all duration-300 group-hover:max-w-xs md:inline-block">
        {label}
      </span>
    </motion.button>
  );
}
