import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.shinaia.com.br"),
  title: {
    default: "Shinã — Plataforma de Inteligência Operacional para Frotas",
    template: "%s | Shinã",
  },
  description:
    "Gerencie frota, operações e equipes com inteligência artificial. Dashboards em tempo real, automação e insights poderosos para empresas de mobilidade e logística.",
  keywords: [
    "frota",
    "gestão operacional",
    "logística",
    "mobilidade",
    "SaaS",
    "IA",
    "inteligência artificial",
  ],
  authors: [{ name: "Shinã" }],
  openGraph: {
    title: "Shinã — Inteligência Operacional para Frotas",
    description:
      "Plataforma SaaS com IA para gestão de frotas, operações e equipes. Do agendamento à análise de desempenho.",
    url: "https://www.shinaia.com.br",
    siteName: "Shinã",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shinã — Inteligência Operacional para Frotas",
    description: "Plataforma SaaS com IA para gestão de frotas, operações e equipes.",
  },
  // Landing pages are indexable; app subdomain gets noindex via middleware header.
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
