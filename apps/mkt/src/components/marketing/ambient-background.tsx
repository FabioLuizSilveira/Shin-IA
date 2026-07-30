// Recria a mesma estrutura de camadas (fundo em movimento + fades de
// gradiente + overlay escuro) do template de referência. Fundo padrão é o
// shader WebGL "wisp" (ver wisp-background.tsx); a prop `src` permite
// sobrepor com uma imagem/gif específico quando necessário.

import { WispBackground } from "./wisp-background";

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
          <WispBackground />
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
