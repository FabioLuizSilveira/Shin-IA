import Link from "next/link";

// Rodapé institucional, reutilizado pela home (via CtaFooter) e por
// pricing/contact.

const FOOTER_LINKS = [
  { label: "Plataforma", href: "/#plataforma" },
  { label: "Soluções", href: "/#solucoes" },
  { label: "Privacidade", href: "/privacidade" },
  { label: "Contato", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <p className="font-body text-sm text-white/50 text-center sm:text-left">
          © {new Date().getFullYear()} Shinã IA. Operações inteligentes em movimento.
        </p>
        <nav className="flex items-center gap-6">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body text-sm text-white/50 hover:text-white transition-colors no-underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
