import type { Metadata } from "next";
import "./globals.css";
import { ShinaThemeProvider } from "@shina/theme";
import { ToastProvider } from "@shina/design-system";

export const metadata: Metadata = {
  metadataBase: new URL("https://mkt.shinaia.com.br"),
  title: {
    default: "Shinã Marketing IA — Anúncios vencedores com IA",
    template: "%s | Shinã Marketing IA",
  },
  description:
    "Crie, clone e publique anúncios com IA. Ad Library de concorrentes, gerador de criativos, relatórios, pesquisa de audiência, MCP Server para agentes e integração com Meta, Google, TikTok, LinkedIn, Reddit e X Ads.",
  openGraph: {
    title: "Shinã Marketing IA",
    description: "Crie, clone e publique anúncios com IA — com aprovação humana em cada etapa.",
    url: "https://mkt.shinaia.com.br",
    siteName: "Shinã Marketing IA",
    locale: "pt_BR",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // className="dark" here (not just via ShinaThemeProvider's effect) so
    // the server-rendered HTML already matches the product default — dark
    // is mkt's default preference, so first paint stays dark instead of
    // flashing light before hydration runs the toggle effect. Light-mode
    // users only see the equivalent flash the other way, once.
    <html lang="pt-BR" className="scroll-smooth dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {/* Wave 2.5 ORBIT: fonte única de tema — dark é o padrão do produto (doc 04 §9) */}
        <ShinaThemeProvider product="mkt" defaultPreference="dark">
          <ToastProvider>{children}</ToastProvider>
        </ShinaThemeProvider>
      </body>
    </html>
  );
}
