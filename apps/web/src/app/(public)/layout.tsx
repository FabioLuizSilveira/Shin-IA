import { Instrument_Serif, Barlow } from "next/font/google";
import "./public.css";

// Layout exclusivo do site institucional público — carrega a tipografia do
// rebrand (Instrument Serif itálico para headlines, Barlow para corpo) sem
// afetar o restante da plataforma, que continua em Inter via globals.css.

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
