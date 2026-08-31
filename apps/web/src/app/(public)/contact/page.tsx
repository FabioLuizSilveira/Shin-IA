"use client";

import { useState } from "react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { Mail, Phone, MapPin, Send, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !message) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company: company || undefined, message }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar. Tente novamente.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="pt-24">
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
                Fale com a <span className="text-gradient">nossa equipe</span>
              </h1>
              <p className="text-lg text-slate-400">
                Quer saber mais sobre o Shinã, agendar uma demo ou conversar sobre planos
                Enterprise? Estamos aqui.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
              {/* Contact info */}
              <div className="lg:col-span-2 space-y-6">
                {[
                  {
                    icon: Mail,
                    label: "Email",
                    value: "diego@shinaia.com.br",
                    href: "mailto:diego@shinaia.com.br",
                  },
                  {
                    icon: Phone,
                    label: "WhatsApp",
                    value: "+55 11 96628-9405",
                    href: "https://wa.me/5511966289405",
                  },
                  {
                    icon: MapPin,
                    label: "Localização",
                    value: "São Paulo, SP — Brasil",
                    href: undefined,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const inner = (
                    <div
                      key={item.label}
                      className="card-glass rounded-2xl p-5 flex items-start gap-4"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">{item.label}</p>
                        <p className="text-sm font-semibold text-white">{item.value}</p>
                      </div>
                    </div>
                  );
                  return item.href ? (
                    <a key={item.label} href={item.href} className="block no-underline">
                      {inner}
                    </a>
                  ) : (
                    <div key={item.label}>{inner}</div>
                  );
                })}

                <div className="card-glass rounded-2xl p-5">
                  <p className="text-xs text-slate-500 mb-2">Horário de atendimento</p>
                  <p className="text-sm text-white font-semibold">Seg–Sex, 9h–18h (BRT)</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Suporte técnico 24/7 para planos Professional e Enterprise
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="lg:col-span-3">
                <div className="card-glass rounded-2xl p-8">
                  {sent ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-5">
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">Mensagem enviada!</h2>
                      <p className="text-slate-400 text-sm max-w-sm">
                        Obrigado pelo contato, {name.split(" ")[0]}! Nossa equipe responderá em até
                        24 horas úteis.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="contact-name"
                            className="block text-xs font-medium text-slate-400 mb-1.5"
                          >
                            Nome completo <span className="text-red-400">*</span>
                          </label>
                          <input
                            id="contact-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="João Silva"
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="contact-email"
                            className="block text-xs font-medium text-slate-400 mb-1.5"
                          >
                            Email <span className="text-red-400">*</span>
                          </label>
                          <input
                            id="contact-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="joao@empresa.com"
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="contact-company"
                          className="block text-xs font-medium text-slate-400 mb-1.5"
                        >
                          Empresa
                        </label>
                        <input
                          id="contact-company"
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Transportes Alfa Ltda."
                          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="contact-message"
                          className="block text-xs font-medium text-slate-400 mb-1.5"
                        >
                          Mensagem <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          id="contact-message"
                          required
                          rows={5}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Conte um pouco sobre sua operação e como podemos ajudar..."
                          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition resize-none"
                        />
                      </div>

                      {error && <p className="text-sm text-red-400">{error}</p>}

                      <button
                        id="contact-submit"
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-xl transition shadow-lg shadow-blue-500/20"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Enviando…
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Enviar mensagem
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
