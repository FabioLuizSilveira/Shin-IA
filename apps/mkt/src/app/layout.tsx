import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mkt.shinaia.com.br"),
  title: {
    default: "Shinã Marketing AI — Anúncios vencedores com IA",
    template: "%s | Shinã Marketing AI",
  },
  description:
    "Crie, clone e publique anúncios com IA. Ad Library de concorrentes, gerador de criativos, MCP Server para agentes e integração com Meta, Google e TikTok Ads.",
  openGraph: {
    title: "Shinã Marketing AI",
    description: "Crie, clone e publique anúncios com IA — com aprovação humana em cada etapa.",
    url: "https://mkt.shinaia.com.br",
    siteName: "Shinã Marketing AI",
    locale: "pt_BR",
    type: "website",
  },
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
