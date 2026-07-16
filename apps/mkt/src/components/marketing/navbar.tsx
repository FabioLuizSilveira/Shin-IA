"use client";

// Navbar do site institucional (rebrand liquid glass, mesmo tratamento de
// apps/web/(public)) — logo real da Shinã Marketing IA + navegação e CTA
// preservados do original (Wave 3).

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "@shina/icons";

const NAV_LINKS = [
  { href: "/#features", label: "Funcionalidades" },
  { href: "/pricing", label: "Preços" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 liquid-glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 no-underline group">
            <Image
              src="/icon.png"
              alt="Shinã Marketing IA"
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            <span className="text-lg font-body font-semibold text-white tracking-tight">
              Shinã Marketing IA
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
            <Link
              href="/signup"
              id="nav-cta-signup"
              className="inline-flex items-center gap-1.5 px-4 py-2 liquid-glass text-white text-sm font-body font-semibold rounded-full transition-colors no-underline hover:bg-white/5"
            >
              Crie sua conta
            </Link>
            <Link
              href="/signup"
              id="nav-cta"
              className="inline-flex items-center gap-1.5 px-4 py-2 liquid-glass-strong text-white text-sm font-body font-semibold rounded-full transition-colors no-underline"
            >
              Entrar
            </Link>
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
              <Link
                href="/signup"
                className="block px-3 py-2.5 liquid-glass text-white text-sm font-body font-semibold rounded-xl text-center no-underline"
              >
                Crie sua conta
              </Link>
              <Link
                href="/signup"
                className="block px-3 py-2.5 liquid-glass-strong text-white text-sm font-body font-semibold rounded-xl text-center no-underline"
              >
                Entrar
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
