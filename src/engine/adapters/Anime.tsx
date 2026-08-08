/**
 * `<Anime>` — deterministic anime.js adapter.
 *
 * anime.js animates against `requestAnimationFrame` and `performance.now()` —
 * both BANNED (ENGINE_DESIGN §5). But every anime instance is also a *timeline
 * you can scrub*: created with `autoplay:false`, it never starts its rAF loop,
 * and `.seek(ms)` jumps it to an absolute time deterministically. This adapter
 * builds the instance once, then seeks it to `timeMs = frame / fps * 1000` every
 * Kino frame.
 *
 *   1. `create()` builds the anime instance from the user's `params`, forcing
 *      `autoplay: false` so no rAF loop ever starts.
 *   2. Each Kino frame, call `.seek(ctx.timeMs)` — anime applies the exact
 *      tweened values for that absolute time to the targets (DOM/object props).
 *
 * `.seek(t)` is a pure function of `t` for a given instance, so two renders of
 * frame N seek to the same `t` and produce identical target state → identical
 * pixels.
 *
 * DETERMINISM NOTE
 * ----------------
 * The only time input is `ctx.timeMs` from `useFrameClock()`. `autoplay:false`
 * means anime never reads `performance.now()` or schedules rAF; `.seek()` is the
 * sole driver and is order-independent. Do not pass `loop`-with-rAF or use
 * anime's running `play()` — only `.seek()`. anime's own RNG-based values (e.g.
 * `() => anime.random(...)`) are evaluated once at instance creation and then
 * fixed, so they are stable across frames (but vary per remount — prefer a
 * seeded value from the spec if you need cross-remount stability). See
 * `__proof__/adapters.proof.ts` (`anime`).
 *
 * npm dep (integrator installs): `animejs` (+ `@types/animejs`). NOT yet in
 * package.json. We support the v3 callable API (`anime(params)` → instance with
 * `.seek`); a v3 default import is the common shape.
 */

import * as React from "react";

import { useFrameClock } from "./frame-time";

/* -------------------------------------------------------------------------- */
/*  Minimal structural anime.js typings                                        */
/* -------------------------------------------------------------------------- */

/** The slice of an anime instance the adapter drives. */
export type AnimeInstance = {
  /** Jump the timeline to absolute `ms`. The sole, deterministic driver. */
  seek: (ms: number) => void;
  /** Total animation duration in ms (read-only here; informational). */
  duration: number;
  /** anime auto-plays by default; we always force it off via params. */
  pause?: () => void;
  [key: string]: unknown;
};

/** anime.js parameter object (targets + tweened props + timing). */
export type AnimeParams = Record<string, unknown>;

/**
 * The anime.js factory. v3 default export is callable: `anime(params)` returns
 * an instance. Injected (not imported) so this engine file has no hard
 * dependency on an uninstalled package.
 */
export type AnimeFactory = (params: AnimeParams) => AnimeInstance;

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

export type AnimeProps = {
  /**
   * The anime.js factory: pass `import anime from "animejs"`.
   */
  readonly anime: AnimeFactory;
  /**
   * Build the anime params for a given root element. Called once when the
   * instance is (re)created. `autoplay` is forced `false` regardless of what you
   * return. Target your DOM via the provided `root` (e.g. `root.querySelectorAll
   * (".dot")`) so the adapter owns the element lifecycle.
   */
  readonly build: (root: HTMLDivElement) => AnimeParams;
  /**
   * The animated DOM. anime mutates these nodes' styles/attrs as it seeks; React
   * owns their structure, anime owns their tweened values for the current frame.
   */
  readonly children?: React.ReactNode;
  readonly style?: React.CSSProperties;
};

/**
 * Deterministic anime.js surface. Builds a paused instance and seeks it to the
 * current Kino frame's time every frame.
 */
export const Anime: React.FC<AnimeProps> = ({
  anime,
  build,
  children,
  style,
}) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const instanceRef = React.useRef<AnimeInstance | null>(null);

  const clock = useFrameClock();
  const buildRef = React.useRef(build);
  buildRef.current = build;

  // Build the (paused) instance once per mount. `useLayoutEffect` so the
  // instance exists and is seeked before the captured paint.
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;

    const params = buildRef.current(root);
    // FORCE autoplay off: this is what prevents anime from starting its rAF /
    // performance.now() loop. `.seek()` becomes the only driver.
    const instance = anime({ ...params, autoplay: false });
    instance.pause?.();
    instanceRef.current = instance;

    return () => {
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime]);

  // Seek to the current frame's time every Kino frame. Pure function of timeMs.
  React.useLayoutEffect(() => {
    instanceRef.current?.seek(clock.timeMs);
  }, [clock.timeMs]);

  return (
    <div
      ref={rootRef}
      style={style}
      data-kino-anime-ms={Math.round(clock.timeMs)}
    >
      {children}
    </div>
  );
};
