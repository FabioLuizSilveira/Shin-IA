import React from "react";
import { useLang } from "@/context/LangContext";
import { BRAND_LOGO } from "@/lib/config";

export function Footer() {
  const { t } = useLang();
  const f = t.footer;
  const year = new Date().getFullYear();

  const cols = [
    { title: f.product, items: [t.nav.product, t.nav.how, t.nav.benefits, t.nav.pricing] },
    { title: f.company, items: ["About", "Blog", "Careers", "Contact"] },
    { title: f.legal, items: ["Privacy", "Terms", "Security", "Cookies"] },
  ];

  return (
    <footer className="relative border-t border-white/10 px-6 py-16">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <a href="#top" className="flex items-center gap-2.5">
            <img src={BRAND_LOGO} alt="Shinã I.A." className="h-10 w-10 object-contain" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold">{t.brand.name}</span>
              <span className="mt-1 text-[10px] tracking-wide text-zinc-500">{t.brand.tagline}</span>
            </span>
          </a>
          <p className="mt-4 max-w-xs text-sm font-light text-zinc-500">{f.tagline}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{c.title}</h4>
            <ul className="mt-4 space-y-2.5">
              {c.items.map((it) => (
                <li key={it}><a href="#top" className="text-sm text-zinc-400 transition-colors hover:text-white">{it}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-14 max-w-7xl border-t border-white/10 pt-6 text-xs text-zinc-600">
        © {year} Shinã I.A. {f.rights}
      </div>
    </footer>
  );
}
