"use client";

// Fundo "gênese cósmica" — recriação em SVG/CSS do efeito do template de
// referência (nebulosa + campo de estrelas + semente neural com dendritos
// ramificados). Sem texto, sem assets externos; posições determinísticas
// para não quebrar a hidratação. Quando a seção entra na tela, a semente
// nasce pequena e cresce: núcleo primeiro, depois os ramos se desenham e
// os nós acendem.

import { useRef } from "react";
import { useInView } from "framer-motion";

interface CosmicBackgroundProps {
  fadeTop?: boolean;
  fadeBottom?: boolean;
}

// Gerador determinístico (LCG) — mesmas estrelas no servidor e no cliente.
function makeStars(count: number, seed: number) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(rand() * 1000),
    y: Math.round(rand() * 800),
    r: +(0.4 + rand() * 1.3).toFixed(2),
    o: +(0.25 + rand() * 0.65).toFixed(2),
    twinkle: i % 4 === 0,
    delay: +(rand() * 4).toFixed(2),
  }));
}

const STARS = makeStars(110, 42);

// Dendritos: ramos curvos saindo do núcleo (500,380), com bifurcações.
// `gen` 0 = tronco (desenha primeiro), 1 = bifurcação (desenha depois).
const BRANCHES: { d: string; gen: 0 | 1 }[] = [
  { d: "M500,380 C555,355 590,345 630,320", gen: 0 },
  { d: "M630,320 C660,300 680,270 700,250", gen: 1 },
  { d: "M630,320 C665,315 700,310 740,300", gen: 1 },
  { d: "M740,300 C770,285 795,270 815,245", gen: 1 },
  { d: "M740,300 C775,305 805,315 835,320", gen: 1 },
  { d: "M500,380 C505,330 495,290 505,245", gen: 0 },
  { d: "M505,245 C515,210 535,185 545,150", gen: 1 },
  { d: "M505,245 C485,215 470,190 450,160", gen: 1 },
  { d: "M450,160 C435,135 430,110 420,85", gen: 1 },
  { d: "M450,160 C465,130 480,115 500,95", gen: 1 },
  { d: "M500,380 C450,360 410,340 370,325", gen: 0 },
  { d: "M370,325 C330,310 300,290 265,255", gen: 1 },
  { d: "M370,325 C345,345 310,350 275,345", gen: 1 },
  { d: "M500,380 C455,405 420,420 380,440", gen: 0 },
  { d: "M380,440 C340,455 300,460 260,480", gen: 1 },
  { d: "M380,440 C360,475 330,500 310,530", gen: 1 },
  { d: "M500,380 C495,430 505,470 490,510", gen: 0 },
  { d: "M490,510 C480,545 460,570 445,600", gen: 1 },
  { d: "M490,510 C505,545 520,575 540,610", gen: 1 },
  { d: "M500,380 C550,400 590,415 630,435", gen: 0 },
  { d: "M630,435 C670,450 700,470 730,495", gen: 1 },
  { d: "M630,435 C665,425 705,418 745,420", gen: 1 },
  { d: "M500,380 C540,330 570,300 600,260", gen: 0 },
  { d: "M600,260 C620,225 650,205 670,175", gen: 1 },
  { d: "M600,260 C575,225 570,190 555,155", gen: 1 },
  { d: "M500,380 C445,375 400,370 350,380", gen: 0 },
  { d: "M350,380 C310,385 280,400 245,415", gen: 1 },
  { d: "M350,380 C315,365 285,350 250,340", gen: 1 },
  { d: "M700,250 C720,225 735,200 745,170", gen: 1 },
  { d: "M260,480 C230,495 205,515 185,545", gen: 1 },
  { d: "M545,150 C560,120 575,100 585,70", gen: 1 },
  { d: "M730,495 C755,520 770,545 780,575", gen: 1 },
];

// Nós luminosos nas bifurcações e pontas dos ramos.
const NODES: [number, number, number][] = [
  [630, 320, 2.6],
  [700, 250, 2],
  [740, 300, 2.4],
  [815, 245, 2],
  [835, 320, 1.8],
  [505, 245, 2.6],
  [545, 150, 2],
  [450, 160, 2.4],
  [420, 85, 1.8],
  [500, 95, 2],
  [370, 325, 2.6],
  [265, 255, 2],
  [275, 345, 1.8],
  [380, 440, 2.4],
  [260, 480, 2],
  [310, 530, 1.8],
  [490, 510, 2.4],
  [445, 600, 2],
  [540, 610, 1.8],
  [630, 435, 2.4],
  [730, 495, 2],
  [745, 420, 1.8],
  [600, 260, 2.6],
  [670, 175, 2],
  [555, 155, 1.8],
  [350, 380, 2.6],
  [245, 415, 2],
  [250, 340, 1.8],
  [745, 170, 1.8],
  [185, 545, 1.8],
  [585, 70, 1.8],
  [780, 575, 1.8],
];

const branchDelay = (gen: 0 | 1, i: number) =>
  gen === 0 ? 0.6 + (i % 6) * 0.12 : 1.7 + (i % 8) * 0.12;

export function CosmicBackground({ fadeTop = false, fadeBottom = false }: CosmicBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <>
      <div
        ref={ref}
        aria-hidden
        className={`absolute inset-0 z-0 overflow-hidden pointer-events-none${inView ? " cosmic-grow" : ""}`}
      >
        <div className="cosmic-nebula" />
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1000 800"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="cosmic-halo">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="18%" stopColor="#cfd9ff" stopOpacity="0.45" />
              <stop offset="45%" stopColor="#8b9aef" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#8b9aef" stopOpacity="0" />
            </radialGradient>
            <filter id="cosmic-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>

          {/* Campo de estrelas */}
          <g>
            {STARS.map((star, i) => (
              <circle
                key={i}
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill="#e7ecff"
                opacity={star.o}
                className={star.twinkle ? "cosmic-twinkle" : undefined}
                style={star.twinkle ? { animationDelay: `${star.delay}s` } : undefined}
              />
            ))}
          </g>

          {/* Semente neural — nasce pequena e cresce */}
          <g className="cosmic-seed">
            <g className="cosmic-core">
              <circle cx={500} cy={380} r={110} fill="url(#cosmic-halo)" />
              <circle
                cx={500}
                cy={380}
                r={22}
                fill="#dfe7ff"
                opacity={0.5}
                filter="url(#cosmic-glow)"
              />
              <circle cx={500} cy={380} r={11} fill="#ffffff" />
            </g>

            {/* brilho difuso dos ramos */}
            <g
              stroke="#aab8ea"
              strokeWidth={3}
              fill="none"
              opacity={0.35}
              filter="url(#cosmic-glow)"
            >
              {BRANCHES.map((branch, i) => (
                <path
                  key={i}
                  d={branch.d}
                  className="cosmic-branch"
                  style={{ animationDelay: `${branchDelay(branch.gen, i)}s` }}
                />
              ))}
            </g>
            {/* traço nítido dos ramos */}
            <g stroke="#dde5fb" strokeWidth={1.2} fill="none" opacity={0.9}>
              {BRANCHES.map((branch, i) => (
                <path
                  key={i}
                  d={branch.d}
                  className="cosmic-branch"
                  style={{ animationDelay: `${branchDelay(branch.gen, i)}s` }}
                />
              ))}
            </g>

            {/* nós luminosos — acendem depois que os ramos chegam neles */}
            {NODES.map(([x, y, r], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                fill="#f0f4ff"
                className="cosmic-node"
                style={{
                  animationDelay: `${2.6 + ((i * 0.2) % 1.4)}s, ${3.2 + ((i * 0.35) % 3)}s`,
                }}
              />
            ))}
          </g>
        </svg>
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
    </>
  );
}
