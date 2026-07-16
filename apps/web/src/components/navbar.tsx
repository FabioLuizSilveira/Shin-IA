"use client";

// Wave 3: reconstruído sobre @shina/design-system + @shina/icons.
// Nenhum markup próprio de navegação — apenas composição dos componentes
// oficiais (doc 10 Grupo D / doc 19 FloatingNavbar).

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Zap } from "@shina/icons";
import { appUrl } from "@/lib/domain";

const NAV_LINKS = [
  { href: "/#features", label: "Funcionalidades" },
  { href: "/pricing", label: "Preços" },
  { href: "/contact", label: "Contato" },
];

const LOGIN_URL = appUrl("/login");

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-header bg-[var(--shina-surface-background)]/80 backdrop-blur-md border-b border-[var(--shina-border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 no-underline group">
            <div className="w-8 h-8 rounded-lg bg-[image:var(--shina-gradient)] flex items-center justify-center shadow-lg shadow-[var(--shina-primary)]/20 group-hover:shadow-[var(--shina-primary)]/40 transition-shadow">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Shinã</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--shina-text-secondary)] hover:text-white transition-colors no-underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href={LOGIN_URL}
              className="text-sm font-medium text-[var(--shina-text-secondary)] hover:text-white transition-colors no-underline"
            >
              Entrar
            </a>
            <a
              href={LOGIN_URL}
              id="nav-cta"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[image:var(--shina-gradient)] text-white text-sm font-semibold rounded-md transition-colors no-underline shadow-lg shadow-[var(--shina-primary)]/20"
            >
              Acessar plataforma
            </a>
          </div>

          <button
            type="button"
            id="nav-mobile-menu"
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-[var(--shina-text-secondary)] hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-[var(--shina-border-subtle)] bg-[var(--shina-surface-background)]/95 backdrop-blur-md">
          <div className="px-4 py-4 space-y-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-[var(--shina-text-primary)] hover:text-white hover:bg-[var(--shina-surface-glass-hover)] rounded-lg transition-colors no-underline"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-[var(--shina-border-default)] flex flex-col gap-2">
              <a
                href={LOGIN_URL}
                className="block px-3 py-2 text-sm font-medium text-[var(--shina-text-secondary)] hover:text-white transition-colors no-underline"
              >
                Entrar
              </a>
              <a
                href={LOGIN_URL}
                className="block px-3 py-2.5 bg-[var(--shina-primary)] text-white text-sm font-semibold rounded-xl text-center no-underline"
              >
                Acessar plataforma
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
