import type { ReactNode } from "react";

export interface FooterProps {
  brand: string;
  links?: { label: string; href: string }[];
  children?: ReactNode;
}

export function Footer({ brand, links, children }: FooterProps) {
  return (
    <footer className="border-t border-[var(--shina-border-subtle)] py-10 text-center text-sm text-[var(--shina-text-tertiary)]">
      {children ?? (
        <p>
          {brand} © {new Date().getFullYear()}
        </p>
      )}
      {links && links.length > 0 && (
        <nav className="flex items-center justify-center gap-4 mt-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hover:text-[var(--shina-text-secondary)] no-underline"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </footer>
  );
}
