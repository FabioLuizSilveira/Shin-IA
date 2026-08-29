// Existing Shinã platform endpoints. Replace with the production URLs when available.
// The landing page does NOT own auth — these route users into the existing platform.
export const PLATFORM = {
  login: "https://app.shinaia.com.br/login",
  signup: "https://app.shinaia.com.br/login",
  demo: "https://app.shinaia.com.br/login",
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
