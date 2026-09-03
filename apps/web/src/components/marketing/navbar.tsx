"use client";

// Navbar do site institucional (rebrand liquid glass) — logo real da Shinã
// IA + navegação e CTA conforme brief de marca.

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "@shina/icons";
import { AuthOptions } from "@/components/auth/auth-options";
import { useDemoLead } from "@/components/marketing/demo-lead-context";

const NAV_LINKS = [
  { href: "/#plataforma", label: "Plataforma" },
  { href: "/#solucoes", label: "Soluções" },
  { href: "/#setores", label: "Setores" },
  { href: "/#sobre", label: "Sobre" },
  { href: "/contact", label: "Contato" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { open: openDemoLead } = useDemoLead();

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 liquid-glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 no-underline group">
              <Image
                src="/brand/shina-ia-symbol.png"
                alt="Shinã IA"
                width={32}
                height={34}
                className="rounded-lg"
                priority
              />
              <span className="text-lg font-body font-semibold text-white tracking-tight">
                Shinã IA
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-body font-medium text-white/70 hover:text-white transition-colors no-underline"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <button
                type="button"
                id="nav-login"
                onClick={() => setLoginOpen(true)}
                className="px-4 py-2 text-white/80 hover:text-white text-sm font-body font-semibold bg-transparent border-0 cursor-pointer transition-colors"
              >
                Entrar
              </button>
              <button
                type="button"
                id="nav-cta"
                onClick={() => openDemoLead("nav")}
                className="inline-flex items-center gap-1.5 px-4 py-2 liquid-glass-strong text-white text-sm font-body font-semibold rounded-full transition-colors border-0 cursor-pointer"
              >
                Agendar Demo
              </button>
            </div>

            <button
              type="button"
              id="nav-mobile-menu"
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 text-white/70 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-white/5 liquid-glass">
            <div className="px-4 py-4 space-y-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm font-body font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors no-underline"
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setLoginOpen(true);
                  }}
                  className="block w-full px-3 py-2.5 text-white/80 hover:text-white text-sm font-body font-semibold bg-white/5 rounded-xl text-center border-0 cursor-pointer"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openDemoLead("nav-mobile");
                  }}
                  className="block w-full px-3 py-2.5 liquid-glass-strong text-white text-sm font-body font-semibold rounded-xl text-center border-0 cursor-pointer"
                >
                  Agendar Demo
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Rendered as a sibling of <header>, not a descendant — <header> has
        the liquid-glass class, whose backdrop-filter establishes a new
        containing block for descendant `position: fixed` elements, which
        was collapsing this modal into the header's own 64px-tall box
        instead of centering it in the viewport. */}
      {loginOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div
            className="absolute inset-0"
            onClick={() => setLoginOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm p-8 bg-slate-950 border border-white/10 rounded-2xl shadow-2xl">
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-white/50 hover:text-white bg-transparent border-0 cursor-pointer"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">Entrar na Shinã</h2>
              <p className="text-sm text-slate-400 mt-1">Uma conta para todos os produtos</p>
            </div>
            <AuthOptions />
          </div>
        </div>
      )}
    </>
  );
}
