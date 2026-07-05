// @shina/flow-engine — motor visual oficial da Shinã (docs 11–16).
// Nenhuma tela implementa efeitos diretamente: tudo vem daqui.

export { FlowBackground, AuroraMesh, FlowLines } from "./backgrounds";
export type { FlowBackgroundProps, AuroraMeshProps, FlowLinesProps } from "./backgrounds";

export {
  NeuralParticles,
  GlowPulse,
  NeuralLoader,
  ThinkingIndicator,
  StreamingText,
} from "./neural";
export type {
  NeuralParticlesProps,
  GlowPulseProps,
  NeuralLoaderProps,
  ThinkingIndicatorProps,
  StreamingTextProps,
  AISubstate,
} from "./neural";

export { MetricCounter, type MetricCounterProps } from "./metric-counter";
export { Skeleton, FlowLoader, type SkeletonProps, type FlowLoaderProps } from "./loaders";
export { useReducedMotion } from "./internal";
