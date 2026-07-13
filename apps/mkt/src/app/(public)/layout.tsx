import { Instrument_Serif, Barlow } from "next/font/google";
import "./public.css";

// Layout exclusivo do site institucional público do mkt — mesmo tratamento
// aplicado em apps/web/(public): Instrument Serif itálico + Barlow, sem
// afetar o restante do produto (dashboard, generator, etc.), que continua
// em Inter via globals.css.

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["italic", "normal"],
  variable: "--font-heading",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${instrumentSerif.variable} ${barlow.variable} bg-black font-body`}>
      {children}
    </div>
  );
}
