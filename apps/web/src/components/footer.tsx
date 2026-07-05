// Wave 3: reconstruído com @shina/icons; estrutura de links preservada.
// O rodapé institucional (link groups) é específico o suficiente para não
// caber no <Footer/> genérico de @shina/landing (que cobre o caso simples
// de marca + links únicos) — mantém-se aqui como composição de tokens.

import Link from "next/link";
import { Zap, ExternalLink } from "@shina/icons";

const FOOTER_LINKS = [
  {
    title: "Produto",
    links: [
      { label: "Funcionalidades", href: "/#features" },
      { label: "Preços", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contato", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos de Uso", href: "/termos" },
      { label: "Privacidade", href: "/privacidade" },
      { label: "Segurança", href: "/seguranca" },
    ],
  },
];

const SOCIAL_LINKS = [
  { href: "https://github.com/FabioLuizSilveira/Shin-IA", label: "GitHub" },
  { href: "https://linkedin.com", label: "LinkedIn" },
  { href: "https://twitter.com", label: "Twitter" },
];

export function Footer() {
  return (
    <footer className="bg-[var(--shina-surface-deep)] border-t border-[var(--shina-border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 no-underline">
              <div className="w-8 h-8 rounded-lg bg-[image:var(--shina-gradient)] flex items-center justify-center">
                <Zap size={16} className="text-white" />
              </div>
              <span className="text-lg font-bold text-white">Shinã</span>
            </Link>
            <p className="text-sm text-[var(--shina-text-secondary)] leading-relaxed max-w-xs">
              Inteligência operacional para frotas e mobilidade. Powered by AI.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {SOCIAL_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-[var(--shina-surface-glass)] hover:bg-[var(--shina-surface-glass-hover)] flex items-center justify-center text-[var(--shina-text-secondary)] hover:text-white transition-colors"
                >
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-[var(--shina-text-secondary)] uppercase tracking-wider mb-4">
                {group.title}
              </h3>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--shina-text-secondary)] hover:text-white transition-colors no-underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--shina-border-subtle)] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--shina-text-tertiary)]">
            © {new Date().getFullYear()} Shinã. Todos os direitos reservados.
          </p>
          <p className="text-xs text-[var(--shina-text-tertiary)]">Feito com ❤️ no Brasil</p>
        </div>
      </div>
    </footer>
  );
}
