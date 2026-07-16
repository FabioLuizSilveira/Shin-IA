// Wave 3: rodapé simples (marca + link para o ecossistema Shinã),
// preservado do original com tokens no lugar de cores hardcoded.

export function Footer() {
  return (
    <footer className="border-t border-[var(--shina-border-subtle)] py-10 text-center text-sm text-[var(--shina-text-tertiary)]">
      Shinã Marketing IA © {new Date().getFullYear()} — parte do ecossistema{" "}
      <a
        href="https://shinaia.com.br"
        className="text-[var(--shina-text-secondary)] hover:text-white no-underline"
      >
        Shinã I.A.
      </a>
    </footer>
  );
}
