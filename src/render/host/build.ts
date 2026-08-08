/**
 * Kino composition host — BUILD + SERVE helpers.
 *
 * `buildHost()` esbuilds `entry.tsx` into a single, self-contained browser
 * bundle (React + engine + design + scenes inlined) — the servable JS the
 * orchestrator injects into a Playwright page. `renderHostHtml()` produces the
 * `index.html` that injects `window.__KINO_SPEC__` (+ VO/fps) and loads the
 * bundle inline, so a served page is one self-contained document with zero
 * network fetches (deterministic, fast, and trivially cacheable).
 *
 * Node-only module (uses `esbuild`, `node:fs`, `node:path`). The browser entry
 * itself never imports this. Renderer-agnostic of capture — it knows nothing
 * about Playwright or ffmpeg; it just turns the entry into bytes.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §5` (host bundle), `docs/ENGINE_DESIGN.md`
 * (render = pure function of `t`; the served page is a deterministic input).
 */
import { build, type BuildOptions, type BuildResult } from "esbuild";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";

import type { VideoSpec } from "../../spec";
import type { VoDurations } from "./stack";

/**
 * Resolve THIS module's real source directory (`src/render/host`).
 *
 * Normally `__dirname` points straight at the source dir (bun / tsx / plain
 * node). But a bundler — notably Next.js webpack, which compiles the web app's
 * server routes that import the render orchestrator — REWRITES `__dirname` to the
 * emitted chunk's location (e.g. `web/.next/server/app/api/storyboard`). esbuild
 * then can't resolve `entry.tsx` next to it and the build fails closed.
 *
 * So we anchor defensively: use `__dirname` when `entry.tsx` actually sits there;
 * otherwise walk up from `__dirname` and `process.cwd()` to find a repo root that
 * contains `src/render/host/entry.tsx`. This keeps the host bundle locatable
 * regardless of how the importing module was bundled, with no env config.
 */
function resolveHostDir(): string {
  const here = path.resolve(__dirname);
  if (existsSync(path.join(here, "entry.tsx"))) return here;

  const rel = path.join("src", "render", "host", "entry.tsx");
  const seen = new Set<string>();
  for (const start of [here, process.cwd()]) {
    let dir = path.resolve(start);
    // Walk up to the filesystem root looking for the source tree.
    for (;;) {
      if (seen.has(dir)) break;
      seen.add(dir);
      if (existsSync(path.join(dir, rel))) {
        return path.join(dir, "src", "render", "host");
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  // Fall back to `__dirname` (the original behaviour) so the error message is the
  // familiar "could not resolve entry.tsx" if the source tree truly is missing.
  return here;
}

/** Absolute path to this module's real source dir (`src/render/host`). */
const HOST_DIR = resolveHostDir();

/** Absolute path to the browser entry this module bundles. */
export const ENTRY_PATH = path.resolve(HOST_DIR, "entry.tsx");

/* -------------------------------------------------------------------------- */
/*  Bundle                                                                     */
/* -------------------------------------------------------------------------- */

export type BuildHostOptions = {
  /**
   * Write the bundle to this path as a side effect (in addition to returning it
   * in-memory). Optional — the orchestrator typically keeps the bundle in
   * memory and inlines it into the served HTML.
   */
  outfile?: string;
  /** Minify the output. Default `true` (smaller served page = faster load). */
  minify?: boolean;
  /** Emit a sourcemap (inline). Default `false`. Useful for the dev command. */
  sourcemap?: boolean;
  /** Override the entry (e.g. a test harness entry). Default `ENTRY_PATH`. */
  entry?: string;
};

export type BuiltHost = {
  /** The bundled JS as a UTF-8 string. */
  code: string;
  /**
   * The bundled CSS as a UTF-8 string — the `@font-face` rules from the
   * imported `@fontsource-variable/*` stylesheets, with their woff2 sources
   * inlined as data URLs by the `dataurl` loader. Empty string when no CSS was
   * emitted. `renderHostHtml` injects this into the page `<head>` so the brand
   * fonts are embedded (no system fallback, no network fetch).
   */
  css: string;
  /** The esbuild result (warnings, metafile if requested). */
  result: BuildResult;
};

/**
 * Shared esbuild options for the host bundle. Targets evergreen Chromium (the
 * only browser the renderer runs), bundles everything to one IIFE, and defines
 * `process.env.NODE_ENV` so React ships its production build (smaller, faster,
 * and — critically — without dev-only timing warnings that touch the clock).
 */
function baseOptions(opts: BuildHostOptions): BuildOptions {
  return {
    entryPoints: [opts.entry ?? ENTRY_PATH],
    bundle: true,
    format: "iife",
    platform: "browser",
    // Chromium is the only target; a recent baseline keeps the bundle small and
    // lets esbuild lower nothing it doesn't have to.
    target: ["chrome120"],
    jsx: "automatic",
    minify: opts.minify ?? true,
    sourcemap: opts.sourcemap ? "inline" : false,
    write: false,
    // A CSS import in the entry makes esbuild emit a SECOND output (the bundled
    // `@font-face` stylesheet). With `write:false` esbuild still needs an
    // `outdir` to assign each in-memory output a path — without it the CSS
    // import errors ("...without an output path configured"). The dir is never
    // written to disk (`write:false`); it only namespaces `outputFiles[].path`,
    // which `buildHost` splits by extension. `entryNames`/`assetNames` keep the
    // emitted names stable and predictable.
    outdir: path.resolve(HOST_DIR, "__kino_host_out__"),
    entryNames: "host",
    assetNames: "host-[name]",
    legalComments: "none",
    // FONT EMBEDDING (review P0): the entry imports the brand variable fonts'
    // `@fontsource-variable/*` CSS so their `@font-face` rules land IN the
    // bundle. esbuild's `css` loader resolves each face's relative
    // `url(./files/*.woff2)` against the woff2/woff/ttf loaders below; `dataurl`
    // inlines the font bytes straight into the injected stylesheet. The served
    // page therefore carries the real Space Grotesk / Inter / JetBrains Mono
    // faces with ZERO network fetches — text renders in-brand, never a system
    // fallback. (`entry.tsx` already gates capture on `document.fonts.ready`, so
    // a frame is only captured once these embedded faces have loaded.)
    loader: {
      ".woff2": "dataurl",
      ".woff": "dataurl",
      ".ttf": "dataurl",
      ".css": "css",
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    // Keep the bundle self-contained: no externals. React, the engine, the
    // design system and the scenes all inline so the served page fetches nothing.
    logLevel: "silent",
  };
}

/**
 * Bundle the browser entry into a single servable JS string.
 *
 * @throws if esbuild reports errors (fail closed — never serve a broken bundle).
 */
export async function buildHost(
  opts: BuildHostOptions = {},
): Promise<BuiltHost> {
  const result = await build(baseOptions(opts));

  if (result.errors.length > 0) {
    throw new Error(
      `buildHost: esbuild failed with ${result.errors.length} error(s):\n` +
        result.errors.map((e) => `  ${e.text}`).join("\n"),
    );
  }
  // With a CSS import in the entry, esbuild emits TWO output files (JS + CSS);
  // split them by extension rather than by index (order is not guaranteed).
  const files = result.outputFiles ?? [];
  const jsOut = files.find((f) => f.path.endsWith(".js"));
  const cssOut = files.find((f) => f.path.endsWith(".css"));
  if (!jsOut) {
    throw new Error("buildHost: esbuild produced no JS output file.");
  }
  const code = jsOut.text;
  const css = cssOut?.text ?? "";

  if (opts.outfile) {
    await fs.mkdir(path.dirname(opts.outfile), { recursive: true });
    await fs.writeFile(opts.outfile, code, "utf8");
    if (css) {
      const cssPath = opts.outfile.replace(/\.js$/, "") + ".css";
      await fs.writeFile(cssPath, css, "utf8");
    }
  }

  return { code, css, result };
}

/* -------------------------------------------------------------------------- */
/*  HTML                                                                       */
/* -------------------------------------------------------------------------- */

export type HostHtmlOptions = {
  /** The spec to inject at `window.__KINO_SPEC__`. */
  spec: VideoSpec;
  /** The bundled host JS (from `buildHost`). */
  bundle: string;
  /**
   * The bundled CSS (from `buildHost().css`) — the brand `@font-face` rules with
   * woff2 inlined as data URLs. Injected into `<head>` so the embedded fonts
   * load before the bundle paints. Optional; empty/omitted = no embedded CSS.
   */
  css?: string;
  /** Measured VO durations by scene id (seconds). Default `{}`. */
  voDurations?: VoDurations;
  /** Composition fps. Default 30. */
  fps?: number;
  /** Initial frame for a plain `goto` (the persistent path overrides via URL). */
  frame?: number;
};

/**
 * Safely embed a value as a `<script>`-inlined JSON literal. Escapes `<` so a
 * stray `</script>` inside a string prop can't break out of the script element
 * (the classic JSON-in-HTML injection); U+2028 / U+2029 are escaped because
 * they are valid JS string chars but are line terminators in a `<script>` source.
 */
function inlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * The full `index.html` for the host: a fixed-size, margin-free page that mounts
 * `#kino-root`, injects the spec/VO/fps onto `window`, then runs the inlined
 * bundle. The page background matches the spec `bg` so any letterbox area
 * outside the stage reads as intentional, not white.
 *
 * Everything is inline (no external `<script src>` / `<link>`), so a served page
 * is a single deterministic document.
 */
export function renderHostHtml(opts: HostHtmlOptions): string {
  const { spec, bundle } = opts;
  const fps = opts.fps ?? 30;
  const voDurations = opts.voDurations ?? {};
  const frame = opts.frame ?? 0;
  const bg = spec.palette.bg;
  // The brand `@font-face` rules (woff2 inlined as data URLs). Defensively
  // neutralise any literal `</style>` so the bundled CSS can't close the tag
  // early; a font data-URL/CSS body never legitimately contains that sequence.
  const fontCss = (opts.css ?? "").replace(/<\/style>/gi, "<\\/style>");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!--
  ASSET BASE. Scene stills carry a CLEAN RELATIVE key (e.g.
  "brand-assets/yupcha/dashboard.webp", from realassets.ts / resolveAsset) and
  render as <img src="brand-assets/…">. The host server only serves files under
  "/assets/…", so without a base those relative srcs resolve to the page root
  and 404 → the device frame renders empty. A <base href="/assets/"> rebases
  every relative URL onto the asset server in one line. Safe: the bundle JS,
  inline styles, and woff2 faces are ALL inline (no relative src/href/url() that
  could be wrongly rebased), and absolute (http(s):// or /-rooted) asset keys are
  unaffected by <base>. This is the single seam that maps a dropped screenshot's
  key to a served bitmap.
-->
<base href="/assets/" />
<title>Kino Host</title>
<style>
${fontCss}
</style>
<style>
  html, body { margin: 0; padding: 0; background: ${bg}; }
  /* No scrollbars, no smooth scroll, no animations from UA defaults. */
  * { -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
  #kino-root { position: absolute; inset: 0; }
</style>
</head>
<body>
<div id="kino-root"></div>
<script>
  window.__KINO_SPEC__ = ${inlineJson(spec)};
  window.__KINO_VO_SECONDS__ = ${inlineJson(voDurations)};
  window.__KINO_FPS__ = ${inlineJson(fps)};
  window.__KINO_INITIAL_FRAME__ = ${inlineJson(frame)};
</script>
<script>
${bundle}
</script>
</body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/*  One-shot convenience                                                       */
/* -------------------------------------------------------------------------- */

export type RenderHostPageOptions = Omit<HostHtmlOptions, "bundle"> &
  BuildHostOptions;

/**
 * Build the bundle AND produce the served HTML in one call — the convenience the
 * orchestrator and the dev command share. Returns the HTML plus the bundle (so a
 * caller can cache the bundle across many specs and skip the rebuild).
 */
export async function renderHostPage(
  opts: RenderHostPageOptions,
): Promise<{ html: string; bundle: string }> {
  const { spec, voDurations, fps, frame, ...buildOpts } = opts;
  const { code, css } = await buildHost(buildOpts);
  const html = renderHostHtml({
    spec,
    bundle: code,
    css,
    voDurations,
    fps,
    frame,
  });
  return { html, bundle: code };
}
