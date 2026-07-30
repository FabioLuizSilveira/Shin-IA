import Stripe from "stripe";

// Instância única do Stripe SDK. Requer STRIPE_SECRET_KEY no ambiente.
// O SDK lança na construção se receber uma string vazia, o que derrubaria
// o módulo inteiro (e a rota que o importa) antes de qualquer try/catch —
// por isso o placeholder: sem chave real, a instância existe mas qualquer
// chamada à API do Stripe falha com um erro 401 tratável pela rota, em vez
// de um crash 500 no import.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_not_configured", {
  apiVersion: "2025-02-24.acacia",
});

export const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
