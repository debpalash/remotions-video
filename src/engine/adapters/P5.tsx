/**
 * `<P5>` — deterministic p5.js adapter (instance mode).
 *
 * p5 in global mode runs its own `requestAnimationFrame` loop and increments
 * `frameCount` off the wall-clock — both BANNED (ENGINE_DESIGN §5). This adapter
 * runs p5 in **instance mode** with the loop OFF and draws exactly one frame per
 * Kino frame:
 *
 *   1. `new p5(sketch, node)` in instance mode — no globals touched.
 *   2. Inside `setup`, call `p.noLoop()` so p5 NEVER schedules a rAF draw.
 *   3. Each Kino frame, set the frame the sketch should draw (via a ref the
 *      adapter owns) and call `p.redraw()` — p5 runs `draw` exactly once,
 *      synchronously. The user's `draw(p, { frame, fps, timeSec, timeMs })`
 *      reads the Kino frame from `ctx`, NOT from p5's own `p.frameCount`.
 *
 * Because `draw` is a pure function of the `ctx.frame` we pass, two renders of
 * frame N produce identical pixels regardless of order.
 *
 * DETERMINISM NOTE
 * ----------------
 * The only animation input is `ctx.frame` (and its `timeSec`/`timeMs` derivates)
 * from `useFrameClock()`. `noLoop()` removes p5's rAF entirely; `p.millis()` /
 * `p.deltaTime` / `p.frameCount` are wall-clock-tainted and MUST NOT be read —
 * use `ctx`. If the sketch needs randomness, call `p.randomSeed(seed)` /
 * `p.noiseSeed(seed)` in `setup` (and optionally re-seed per frame from
 * `ctx.frame`) so it is reproducible. See `__proof__/adapters.proof.ts` (`p5`).
 *
 * npm dep (integrator installs): `p5` (+ `@types/p5`). NOT yet in package.json.
 */

import * as React from "react";

import { useFrameClock, type FrameClock } from "./frame-time";

/* -------------------------------------------------------------------------- */
/*  Minimal structural p5 typings                                              */
/* -------------------------------------------------------------------------- */

/**
 * The slice of the p5 instance the adapter and sketches use. Kept structural so
 * the adapter type-checks without `@types/p5` installed; the integrator's real
 * `p5.p5InstanceExtensions` is assignable to this. Sketches that need the full
 * surface can cast `p as unknown as import("p5")`.
 */
export type P5Instance = {
  createCanvas: (w: number, h: number) => unknown;
  noLoop: () => void;
  redraw: (n?: number) => void;
  remove: () => void;
  pixelDensity: (d?: number) => number;
  randomSeed: (seed: number) => void;
  noiseSeed: (seed: number) => void;
  [key: string]: unknown;
};

/** A p5 instance-mode sketch: `(p) => { p.setup = …; p.draw = … }`. */
type P5SketchFn = (p: P5Instance) => void;

/** The p5 constructor (instance mode): `new p5(sketch, node)`. */
type P5Constructor = new (sketch: P5SketchFn, node: HTMLElement) => P5Instance;

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

export type P5Props = {
  /** Canvas width in CSS px. */
  readonly width: number;
  /** Canvas height in CSS px. */
  readonly height: number;
  /**
   * The p5 module. Pass `import p5 from "p5"` (`p5`). Injected rather than
   * imported here so this engine file has no hard dependency on an uninstalled
   * package — the integrator wires it once at the call site.
   */
  readonly p5: P5Constructor;
  /**
   * One-time setup. Create the canvas, set color mode, seed RNG. `noLoop()` is
   * called by the adapter immediately after — do not start a loop here.
   */
  readonly setup?: (p: P5Instance, ctx: FrameClock) => void;
  /**
   * The per-frame draw. Pure function of `ctx.frame`. Called once per Kino
   * frame via `redraw()`. Do NOT read `p.frameCount`/`p.millis()`/`p.deltaTime`
   * (wall-clock) — read `ctx`.
   */
  readonly draw: (p: P5Instance, ctx: FrameClock) => void;
  /** Pixel density. Fixed (default 1) for resolution-stable output. */
  readonly pixelDensity?: number;
  readonly style?: React.CSSProperties;
};

/**
 * Deterministic p5 surface. Mounts an instance-mode sketch with the loop
 * disabled and redraws it once per Kino frame at the current `frame`.
 */
export const P5: React.FC<P5Props> = ({
  width,
  height,
  p5: P5Ctor,
  setup,
  draw,
  pixelDensity = 1,
  style,
}) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const instanceRef = React.useRef<P5Instance | null>(null);

  // Keep the LATEST clock + callbacks in refs so the single long-lived p5
  // instance always draws the current frame without being recreated. The
  // sketch closure reads `clockRef.current` at redraw time.
  const clock = useFrameClock();
  const clockRef = React.useRef<FrameClock>(clock);
  clockRef.current = clock;
  const drawRef = React.useRef(draw);
  drawRef.current = draw;
  const setupRef = React.useRef(setup);
  setupRef.current = setup;

  // Create the instance once. The sketch wires p5's setup/draw to our refs.
  React.useLayoutEffect(() => {
    const node = hostRef.current;
    if (node === null) return;

    const sketch: P5SketchFn = (p) => {
      p.setup = () => {
        p.createCanvas(width, height);
        p.pixelDensity(pixelDensity);
        setupRef.current?.(p, clockRef.current);
        // Kill p5's own animation loop — WE drive every frame via redraw().
        p.noLoop();
      };
      // p5 calls this on each redraw(); it pulls the current Kino frame.
      p.draw = () => {
        drawRef.current(p, clockRef.current);
      };
    };

    const instance = new P5Ctor(sketch, node);
    instanceRef.current = instance;

    return () => {
      instance.remove();
      instanceRef.current = null;
    };
    // Recreate only if the canvas geometry or the p5 module itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P5Ctor, width, height, pixelDensity]);

  // Drive one draw per Kino frame. Setting frame state then redraw() runs the
  // user's `draw` exactly once, synchronously, for the current frame.
  React.useLayoutEffect(() => {
    instanceRef.current?.redraw();
  }, [clock.frame, clock.fps]);

  return (
    <div
      ref={hostRef}
      style={{ width, height, ...style }}
      data-kino-p5-frame={clock.frame}
    />
  );
};
