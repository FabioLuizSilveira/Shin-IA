"use client";

// Fundo WebGL "wisp" — porta do shader do template de referência (Nexus -
// AI Intelligence): fitas onduladas desenhadas por acúmulo de glow sobre
// fundo preto, via requestAnimationFrame. Recolorido da paleta
// esmeralda/ciano original para indigo/violeta/champanhe (mesma paleta de
// `.silk-sheet`/`.cosmic-nebula` em public.css), mantendo a estrutura do
// shader (6 wisps, mesma fórmula de onda e glow por iteração `i`).

import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.y -= 0.5;
    uv.x *= u_resolution.x / u_resolution.y;
    vec3 finalColor = vec3(0.0);
    for (float i = 1.0; i <= 6.0; i++) {
      float t = u_time * 0.3 + i * 0.15;
      float y = sin(uv.x * (1.5 + i * 0.2) + t) * 0.15 * cos(t * 0.5);
      y += cos(uv.x * (1.0 + i * 0.3) - t * 0.8) * 0.1;
      float thickness = 0.0015 * i;
      float glow = thickness / abs(uv.y - y);
      vec3 color = vec3(0.16 + i * 0.05, 0.10 + i * 0.03, 0.30 + i * 0.06);
      finalColor += color * glow;
    }
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

export function WispBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    function resize() {
      if (!canvas || !gl) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize);
    resize();

    const program = gl.createProgram();
    if (!program) return;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]),
      gl.STATIC_DRAW,
    );
    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    function draw(timeSeconds: number) {
      if (!gl) return;
      gl.uniform1f(timeLocation, timeSeconds);
      gl.uniform2f(resolutionLocation, canvas!.width, canvas!.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameId: number | null = null;
    // Uncapped rAF issued a full-viewport 6-iteration fragment shader draw
    // call on every frame, forever, for as long as the tab stayed open —
    // the dominant cost behind this page's Lighthouse main-thread-work/TBT
    // numbers (confirmed via a fresh mobile audit after the cosmic-
    // background fix landed — this was the much bigger remaining cause). A
    // slow wave/glow effect doesn't need 60fps to read as smooth, so cap it
    // at 30fps, and stop issuing draw calls entirely while the tab is
    // hidden or this section has scrolled out of view.
    const FRAME_INTERVAL_MS = 1000 / 30;
    let lastDrawMs = 0;
    let running = !document.hidden;

    function handleVisibility() {
      running = !document.hidden;
    }
    document.addEventListener("visibilitychange", handleVisibility);

    let inView = true;
    let observer: IntersectionObserver | null = null;
    if (canvas.parentElement) {
      observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
      });
      observer.observe(canvas.parentElement);
    }

    if (reducedMotion) {
      draw(6);
    } else {
      const render = (time: number) => {
        if (running && inView && time - lastDrawMs >= FRAME_INTERVAL_MS) {
          lastDrawMs = time;
          draw(time * 0.001);
        }
        frameId = requestAnimationFrame(render);
      };
      frameId = requestAnimationFrame(render);
    }

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      observer?.disconnect();
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 w-full h-full opacity-80 mix-blend-screen pointer-events-none"
    />
  );
}
