// Substitui os vídeos de fundo do template de referência (hospedados na
// conta do autor original — ver plano de rebrand, não copiados por questão
// de propriedade do asset). Recria a mesma estrutura de camadas (fundo em
// movimento + fades de gradiente + overlay escuro) só que com blobs CSS
// animados nas cores da marca, no lugar de vídeo real.

interface AmbientBackgroundProps {
  /** mídia de fundo (gif/imagem) — quando presente, substitui os blobs animados */
  src?: string;
  /** opacidade do fundo animado, 0–100 (combina com o tratamento do vídeo original por seção) */
  opacity?: number;
  /** dessatura o fundo (usado no Stats, como o `saturate-0` do original) */
  desaturate?: boolean;
  /** fades nas bordas — replicam os divs de gradiente do template original */
  fadeTop?: boolean;
  fadeBottom?: boolean;
  fadeBottomTall?: boolean;
  /** overlay escuro uniforme sobre o fundo animado */
  darkOverlay?: boolean;
}

export function AmbientBackground({
  src,
  opacity = 100,
  desaturate = false,
  fadeTop = false,
  fadeBottom = false,
  fadeBottomTall = false,
  darkOverlay = false,
}: AmbientBackgroundProps) {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        style={{ opacity: opacity / 100, filter: desaturate ? "saturate(0)" : undefined }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- gif animado externo; next/image congelaria/otimizaria o frame
          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            {/* Filtro de turbulência que dobra as bandas de gradiente em
                pregas orgânicas — recria a "seda líquida" iridescente do
                vídeo de referência. */}
            <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
              <filter id="silk-warp" x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.0035 0.007"
                  numOctaves="2"
                  seed="7"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="380"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </svg>
            <div className="silk-wrap">
              <div className="silk-sheet" />
              <div className="silk-sheet silk-sheet-b" />
            </div>
          </>
        )}
      </div>

      {fadeTop && (
        <div
          aria-hidden
          className="absolute top-0 left-0 w-full h-[200px] bg-gradient-to-b from-black to-transparent z-0 pointer-events-none"
        />
      )}
      {fadeBottom && (
        <div
          aria-hidden
          className="absolute bottom-0 left-0 w-full h-[200px] bg-gradient-to-t from-black to-transparent z-0 pointer-events-none"
        />
      )}
      {fadeBottomTall && (
        <div
          aria-hidden
          className="absolute bottom-0 left-0 w-full h-[300px] bg-gradient-to-t from-black to-transparent z-0 pointer-events-none"
        />
      )}
      {darkOverlay && (
        <div aria-hidden className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />
      )}
    </>
  );
}
