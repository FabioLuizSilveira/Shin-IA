import Link from "next/link";
import { Zap, ExternalLink } from "lucide-react";

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

export function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 no-underline">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Shinã</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Inteligência operacional para frotas e mobilidade. Powered by AI.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {[
                { href: "https://github.com/FabioLuizSilveira/Shin-IA", label: "GitHub" },
                { href: "https://linkedin.com", label: "LinkedIn" },
                { href: "https://twitter.com", label: "Twitter" },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                {group.title}
              </h3>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors no-underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Shinã. Todos os direitos reservados.
          </p>
          <p className="text-xs text-slate-500">Feito com ❤️ no Brasil</p>
        </div>
      </div>
    </footer>
  );
}
