"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Zap } from "lucide-react";

const NAV_LINKS = [
  { href: "/#features", label: "Funcionalidades" },
  { href: "/pricing", label: "Preços" },
  { href: "/contact", label: "Contato" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 no-underline group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Shinã</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors no-underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="https://app.shina.com.br/login"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors no-underline"
            >
              Entrar
            </Link>
            <Link
              href="/contact"
              id="nav-cta"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors no-underline shadow-lg shadow-blue-500/20"
            >
              Começar grátis
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            id="nav-mobile-menu"
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-md">
          <div className="px-4 py-4 space-y-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors no-underline"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <Link
                href="https://app.shina.com.br/login"
                className="block px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors no-underline"
              >
                Entrar
              </Link>
              <Link
                href="/contact"
                className="block px-3 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl text-center no-underline"
              >
                Começar grátis
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
