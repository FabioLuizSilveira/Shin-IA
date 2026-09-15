import { Unbounded, Outfit, JetBrains_Mono } from "next/font/google";
import { DemoLeadProvider } from "@/components/marketing/demo-lead-context";
import "./public.css";

// Layout exclusivo do site institucional público — tipografia alinhada ao
// blueprint de design da LP Autoloc (Unbounded para display, Outfit para
// corpo, JetBrains Mono para eyebrows/dados), aplicado sobre o fundo real
// da Autoloc (slate azul-acinzentado #3A3A4F — ver public.css). Segue
// isolado do restante da plataforma, que continua em Inter via
// globals.css.

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-heading",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-data",
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${unbounded.variable} ${outfit.variable} ${jetbrainsMono.variable} bg-body font-body`}
    >
      <DemoLeadProvider>{children}</DemoLeadProvider>
    </div>
  );
}
