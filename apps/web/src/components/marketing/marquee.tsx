// Faixa de marquee editorial (texto contornado rolando) — réplica em CSS
// puro do blueprint real da Autoloc (Differentiators.jsx, via
// react-fast-marquee); duplicamos a trilha e animamos translateX(-50%)
// para não precisar de uma lib nova só para isso.

const WORDS = ["INTELIGÊNCIA", "AUTOMAÇÃO", "GOVERNANÇA", "ESCALA"];

function Track() {
  return (
    <>
      {WORDS.map((word, idx) => (
        <span
          key={word}
          className={
            idx % 2 === 0
              ? "font-heading font-black text-5xl md:text-7xl px-8 text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] to-[#8A2BE2]"
              : "font-heading font-black text-5xl md:text-7xl px-8 text-transparent"
          }
          style={idx % 2 !== 0 ? { WebkitTextStroke: "1px rgba(255,255,255,0.3)" } : undefined}
        >
          {word}
        </span>
      ))}
    </>
  );
}

export function Marquee() {
  return (
    <section className="py-16 border-y border-white/10 overflow-hidden select-none">
      <div className="marquee-track">
        <Track />
        <Track />
      </div>
    </section>
  );
}
