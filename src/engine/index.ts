/**
 * Kino runtime — public surface.
 *
 * The deterministic, component-first frame engine (ENGINE_DESIGN). Everything a
 * scene needs to express motion as a pure function of `t`, and nothing that
 * touches a wall-clock or unseeded RNG.
 */

export {
  FrameProvider,
  useFrame,
  useCurrentFrame,
  type FrameState,
  type FrameProviderProps,
} from "./frame";

export {
  interpolate,
  spring,
  measureSpring,
  DEFAULT_SPRING_CONFIG,
  type ExtrapolateType,
  type InterpolateOptions,
  type SpringConfig,
  type SpringParams,
} from "./timing";

export {
  Sequence,
  Series,
  measureSeries,
  type SequenceProps,
  type SeriesProps,
  type SeriesSequenceProps,
} from "./sequence";

export {
  installDeterminism,
  seededRandom,
  type DeterminismHandle,
  type InstallOptions,
} from "./sandbox";
