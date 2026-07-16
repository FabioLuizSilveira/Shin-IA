// Rodapé institucional — mesma marca + link do original (Wave 3), reskin
// liquid glass.

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 text-center text-sm font-body text-white/50">
      Shinã Marketing IA © {new Date().getFullYear()} — parte do ecossistema{" "}
      <a href="https://shinaia.com.br" className="text-white/70 hover:text-white no-underline">
        Shinã I.A.
      </a>
    </footer>
  );
}
