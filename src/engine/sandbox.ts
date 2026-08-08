/**
 * Kino runtime — determinism sandbox (ENGINE_DESIGN §5).
 *
 * Before any scene mounts, the runtime replaces non-deterministic globals so a
 * frame is a pure function of `t`. Same `t` -> same pixels, in any order, on
 * any worker. This is what lets frame-range sharding (§4) be coordination-free.
 *
 * Pure / self-contained. No external dependency. The seeded PRNG is a Mulberry32
 * variant (small, fast, well-distributed) seeded from spec + scene id so a given
 * frame's randomness is reproducible across renders.
 */

export type DeterminismHandle = {
  /** Frame currently being rendered. The renderer updates this per frame. */
  setFrame(frame: number): void;
  /** Re-seed the PRNG (e.g. per scene id). */
  reseed(seed: number | string): void;
  /** Restore every patched global. Idempotent. */
  restore(): void;
  /** True while the sandbox is installed. */
  readonly installed: boolean;
};

export type InstallOptions = {
  fps: number;
  /** Initial frame. Default 0. */
  frame?: number;
  /** Initial PRNG seed. Default 1. */
  seed?: number | string;
  /**
   * Target object to patch. Defaults to `globalThis`. Injectable so the assert
   * harness can verify behaviour against a fake global without touching node's.
   */
  target?: Record<string, unknown> & {
    Math?: Math;
    Date?: DateConstructor;
    performance?: { now(): number };
    requestAnimationFrame?: (cb: (t: number) => void) => number;
    cancelAnimationFrame?: (handle: number) => void;
  };
};

/** Mulberry32 — deterministic 32-bit PRNG. Returns a function in [0,1). */
function mulberry32(seedInt: number): () => number {
  let a = seedInt >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string seed to a 32-bit int (FNV-1a). */
function hashSeed(seed: number | string): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Installs the determinism sandbox onto the target global. Returns a handle to
 * drive the frame and restore the originals. Calling twice without restoring
 * returns a no-op-restore handle pointing at the already-installed patch.
 */
export function installDeterminism(
  options: InstallOptions,
): DeterminismHandle {
  const { fps } = options;
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error("installDeterminism requires fps > 0");
  }

  const target = (options.target ?? (globalThis as never)) as NonNullable<
    InstallOptions["target"]
  >;

  let currentFrame = options.frame ?? 0;
  let baseSeed = hashSeed(options.seed ?? 1);

  // Frame-pure seeding: each frame gets an INDEPENDENT stream derived from
  // (baseSeed, frame). A worker rendering frame N thus produces identical
  // randomness regardless of render order or which other frames its shard
  // holds — the precondition that makes frame-range sharding (§4) safe. (A
  // single stream advanced by call-order would give frame 0 and frame 45 the
  // same values on different shards → flicker on shard boundaries.)
  const frameSeed = (frame: number): number =>
    (baseSeed ^ Math.imul((frame >>> 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  let rand = mulberry32(frameSeed(currentFrame));

  // Virtual clock in ms, driven purely by the current frame (§5).
  const virtualNow = (): number => (currentFrame / fps) * 1000;

  // Snapshot originals so restore is exact.
  const original = {
    mathRandom: target.Math?.random,
    dateNow: target.Date?.now,
    performanceNow: target.performance?.now?.bind(target.performance),
    raf: target.requestAnimationFrame,
    caf: target.cancelAnimationFrame,
    DateCtor: target.Date,
  };

  // --- Math.random -> seeded PRNG -----------------------------------------
  if (target.Math) {
    target.Math.random = () => rand();
  }

  // --- performance.now -> virtual clock -----------------------------------
  if (target.performance) {
    target.performance.now = () => virtualNow();
  }

  // --- Date.now + new Date() -> virtual clock -----------------------------
  if (target.Date) {
    const RealDate = target.Date;
    // Subclass so `new Date()` (no args) reads the virtual clock while every
    // other Date usage (parsing, explicit timestamps) behaves normally.
    const PatchedDate = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(virtualNow());
        } else {
          // @ts-expect-error forwarding the variadic Date overloads
          super(...args);
        }
      }
      static now(): number {
        return virtualNow();
      }
    };
    target.Date = PatchedDate as unknown as DateConstructor;
  }

  // --- requestAnimationFrame -> synchronous, fires at the virtual clock ----
  // A scene that (legacy) drives motion via rAF still renders deterministically:
  // the callback fires once, immediately, with the current virtual timestamp.
  let rafHandle = 1;
  target.requestAnimationFrame = (cb: (t: number) => void): number => {
    const h = rafHandle++;
    cb(virtualNow());
    return h;
  };
  target.cancelAnimationFrame = (): void => {
    /* no-op: nothing is ever pending under the synchronous virtual clock */
  };

  let installed = true;

  return {
    setFrame(frame: number): void {
      currentFrame = frame;
      // Re-seed for the new frame so randomness stays frame-pure (see above).
      rand = mulberry32(frameSeed(frame));
    },
    reseed(seed: number | string): void {
      baseSeed = hashSeed(seed);
      rand = mulberry32(frameSeed(currentFrame));
    },
    restore(): void {
      if (!installed) {
        return;
      }
      if (target.Math && original.mathRandom) {
        target.Math.random = original.mathRandom;
      }
      if (target.performance && original.performanceNow) {
        target.performance.now = original.performanceNow;
      }
      if (original.DateCtor) {
        target.Date = original.DateCtor;
      } else if (original.dateNow && target.Date) {
        target.Date.now = original.dateNow;
      }
      target.requestAnimationFrame = original.raf;
      target.cancelAnimationFrame = original.caf;
      installed = false;
    },
    get installed(): boolean {
      return installed;
    },
  };
}

/**
 * Pure seeded RNG factory — for scenes that want deterministic randomness
 * explicitly (preferred over touching `Math.random`). Same seed -> same stream.
 */
export function seededRandom(seed: number | string): () => number {
  return mulberry32(hashSeed(seed));
}
