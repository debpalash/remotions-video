/**
 * crawl.ts — Playwright (chromium) brand ingest.
 *
 * Given a URL, capture: full-page screenshot, an area-weighted color sample,
 * font-family names in use, logo (header img / og:image / favicon), hero / og
 * image, and the salient headline / value-prop copy.
 *
 * Design rules honored:
 *  - Cache by hash(url): a second crawl of the same URL is a disk read.
 *  - Respect robots.txt best-effort (fetch + parse; honor a matching Disallow).
 *  - Degrade gracefully when blocked / on error — always return a usable
 *    (possibly partial) RawCrawl, never throw to the caller for normal failures.
 *  - Nothing here feeds motion. `capturedAt` is provenance only. No Math.random.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import type { Browser, Page } from "playwright";

import { normalizeBrandKit, type BrandKit, type RawCrawl } from "./brandkit";

/* ──────────────────────────────── options ────────────────────────────────── */

export type CrawlOptions = {
  /** Cache root. Default: <os.tmpdir>/yupcha-ingest-cache. */
  cacheDir?: string;
  /** Force a fresh crawl, ignoring (but refreshing) cache. */
  noCache?: boolean;
  /** Honor robots.txt. Default true (best-effort). */
  respectRobots?: boolean;
  /** Per-page navigation timeout in ms. Default 20000. */
  timeoutMs?: number;
  /** Viewport. Default 1440×900 desktop. */
  viewport?: { width: number; height: number };
  /** Device-pixel-ratio for captures. Default 2 (retina-crisp product stills). */
  deviceScaleFactor?: number;
  /** Max section screenshots to capture by scrolling. Default 4. */
  maxSectionShots?: number;
  /** Max copy nodes to sample. Default 40. */
  maxCopyNodes?: number;
  /** Identify ourselves honestly to the origin. */
  userAgent?: string;
};

const DEFAULTS = {
  respectRobots: true,
  timeoutMs: 20_000,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  maxSectionShots: 4,
  maxCopyNodes: 40,
  userAgent:
    "Mozilla/5.0 (compatible; YupchaBrandBot/1.0; +https://yupcha.com/bot)",
};

/**
 * Browser-context init shim, injected via `addInitScript` BEFORE any page or
 * `page.evaluate` script runs. When this module is bundled with esbuild/tsx
 * (keepNames on), our in-page functions are rewritten to call `__name(fn,"…")`
 * and class fields to `__publicField(...)` — helpers that don't exist in the
 * page. Without this shim every extractor throws `__name is not defined` and we
 * silently fall back to 0 copy / default palette. Passed as a STRING so it is
 * never itself rewritten by the bundler.
 */
const EVAL_SHIM_SRC =
  "(()=>{var g=globalThis;" +
  "if(typeof g.__name==='undefined')g.__name=function(f){return f;};" +
  "if(typeof g.__publicField==='undefined')g.__publicField=function(o,k,v){" +
  "Object.defineProperty(o,k,{enumerable:true,configurable:true,writable:true,value:v});return v;};" +
  "})();";

/** Stable cache key for a URL: sha256 of its normalized form, first 16 hex. */
export function hashUrl(url: string): string {
  const norm = normalizeUrlForHash(url);
  return createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

/** Normalize a URL for hashing: lowercase host, drop fragment + trailing slash. */
function normalizeUrlForHash(url: string): string {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim().toLowerCase();
  }
}

function cacheRoot(opts: CrawlOptions): string {
  return opts.cacheDir ?? path.join(os.tmpdir(), "yupcha-ingest-cache");
}

/* ──────────────────────────── public entrypoints ─────────────────────────── */

/**
 * Crawl `url` and return a normalized, typed BrandKit. Cached by hash(url).
 * Never throws for ordinary failures — returns a degraded BrandKit instead.
 */
export async function ingest(
  url: string,
  options: CrawlOptions = {},
): Promise<BrandKit> {
  const opts = { ...DEFAULTS, ...options };
  const id = hashUrl(url);
  const dir = path.join(cacheRoot(opts), id);

  if (!opts.noCache) {
    const cached = await readCachedKit(dir);
    if (cached) return cached;
  }

  const raw = await crawl(url, opts);
  const kit = normalizeBrandKit(raw, id);
  await writeCachedKit(dir, kit);
  return kit;
}

/**
 * Low-level crawl: returns the RawCrawl (un-normalized). Exposed for callers
 * that want to re-normalize without re-fetching. Caches the raw payload too.
 */
export async function crawl(
  url: string,
  options: CrawlOptions = {},
): Promise<RawCrawl> {
  const opts = { ...DEFAULTS, ...options };
  const target = url.includes("://") ? url : `https://${url}`;
  const id = hashUrl(url);
  const dir = path.join(cacheRoot(opts), id);
  await fs.mkdir(dir, { recursive: true });

  const notes: string[] = [];
  const capturedAt = new Date().toISOString();

  // Robots best-effort gate.
  if (opts.respectRobots) {
    const allowed = await robotsAllows(target, opts.userAgent);
    if (allowed === false) {
      notes.push("robots.txt disallows this path; returning degraded crawl.");
      return degraded(target, notes, capturedAt);
    }
    if (allowed === null) notes.push("robots.txt unreadable; proceeding best-effort.");
  }

  let browser: Browser | null = null;
  try {
    browser = await launchChromium(opts.userAgent);
  } catch (e) {
    notes.push(`chromium launch failed (${errMsg(e)}); returning metadata-only crawl.`);
    return await metadataOnly(target, opts, notes, capturedAt);
  }

  try {
    const ctx = await browser.newContext({
      viewport: opts.viewport,
      userAgent: opts.userAgent,
      // Allow self-signed / local dev certs (e.g. a local https://…:3002 app),
      // so ingest can scrape a developer's own running instance, not just public
      // sites. Ingest is a read-only scrape; cert strictness adds no safety here.
      ignoreHTTPSErrors: true,
      // Retina capture: 2× device pixels → crisp product stills for the
      // ProductShot screen slot. Screenshots are physical-pixel, so a 1440-wide
      // viewport yields a 2880-wide PNG. CSS px in measurements stay unchanged.
      deviceScaleFactor: opts.deviceScaleFactor ?? 2,
      // Reduce motion so a screenshot is a stable frame, not mid-animation.
      reducedMotion: "reduce",
    });

    // Bundler-immunity shim. tsx/esbuild rewrites our in-page `page.evaluate`
    // arrow/named functions to call a `__name(fn,"…")` helper (keepNames). That
    // helper does NOT exist in the browser context, so EVERY extractor threw
    // `ReferenceError: __name is not defined` — the real cause of "0 copy /
    // default palette". Define a no-op shim (and a `__publicField` for class-
    // field downleveling) before any page or evaluate script runs.
    await ctx.addInitScript(EVAL_SHIM_SRC);

    const page = await ctx.newPage();

    let finalUrl = target;
    try {
      const resp = await page.goto(target, {
        // Wait for the JS app to render, not just the HTML doc. SPAs paint
        // nothing at domcontentloaded; "load" + a networkidle settle below gives
        // hydration time to typeset real copy and lay out the product UI.
        waitUntil: "load",
        timeout: opts.timeoutMs,
      });
      finalUrl = page.url() || target;
      if (resp && resp.status() >= 400) {
        notes.push(`navigation returned HTTP ${resp.status()}; capturing what loaded.`);
      }
      // Full-render settle: let late CSS/fonts/XHR finish, then explicitly wait
      // for web-fonts and trigger lazy content so screenshots are complete.
      await page
        .waitForLoadState("networkidle", { timeout: Math.min(8000, opts.timeoutMs) })
        .catch(() => notes.push("network did not idle; captured early."));
      await settleRender(page).catch((e) =>
        notes.push(`render settle incomplete (${errMsg(e)}).`),
      );
    } catch (e) {
      notes.push(`navigation failed (${errMsg(e)}); attempting partial capture.`);
    }

    const meta = await extractMeta(page).catch((e) => {
      notes.push(`meta extraction failed (${errMsg(e)}).`);
      return emptyMeta();
    });

    const colors = await sampleColors(page).catch((e) => {
      notes.push(`color sampling failed (${errMsg(e)}).`);
      return [] as RawCrawl["colors"];
    });

    const fonts = await sampleFonts(page).catch((e) => {
      notes.push(`font sampling failed (${errMsg(e)}).`);
      return [] as RawCrawl["fonts"];
    });

    const copy = await sampleCopy(page, opts.maxCopyNodes).catch((e) => {
      notes.push(`copy extraction failed (${errMsg(e)}).`);
      return [] as RawCrawl["copy"];
    });

    // Screenshots: capture MULTIPLE high-res stills so the ProductShot screen
    // slot has real product imagery, not one flat full-page strip:
    //   1. hero      — the top fold (viewport-framed), the primary product UI
    //   2. screenshot — the full-page capture (context / fallback)
    //   3. section-N — key sections discovered by scrolling (features, etc.)
    const images: RawCrawl["images"] = [];
    const dsf = opts.deviceScaleFactor ?? 2;
    const vp = await page.viewportSize();

    // 1. Hero — the above-the-fold frame at natural scroll position.
    try {
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined);
      const heroPath = path.join(dir, "hero.png");
      await page.screenshot({ path: heroPath, fullPage: false, animations: "disabled" });
      images.push({
        src: finalUrl,
        path: heroPath,
        role: "hero",
        width: vp ? vp.width * dsf : undefined,
        height: vp ? vp.height * dsf : undefined,
      });
    } catch (e) {
      notes.push(`hero screenshot failed (${errMsg(e)}).`);
    }

    // 2. Full-page screenshot (context + fallback).
    const shotPath = path.join(dir, "screenshot.png");
    try {
      await page.screenshot({ path: shotPath, fullPage: true, animations: "disabled" });
      images.push({
        src: finalUrl,
        path: shotPath,
        role: "screenshot",
        width: vp ? vp.width * dsf : undefined,
        height: vp ? vp.height * dsf : undefined,
      });
    } catch (e) {
      notes.push(`full-page screenshot failed (${errMsg(e)}).`);
    }

    // 3. Section shots — find major content sections and frame each one.
    // Sites with scroll-triggered (IntersectionObserver) reveals paint a section
    // only once it has actually entered the viewport. Jumping straight to a far
    // target right after the full-page screenshot (which reset scroll to top)
    // races the reveal → blank stills. So we scroll MONOTONICALLY DOWN, stepping
    // through the targets in order with a settle at each, so every section is
    // scrolled INTO view (triggering its reveal) before we capture it.
    try {
      const sections = await findSections(page, opts.maxSectionShots);
      let kept = 0;
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const secPath = path.join(dir, `section-${kept + 1}.png`);
        try {
          await scrollIntoViewSettled(page, s.scrollY);
          // Re-measure: bail if, after settling, the viewport is still mostly
          // empty (lazy content never arrived) so we never emit a blank still.
          const dense = await viewportHasContent(page);
          if (!dense) continue;
          await page.screenshot({ path: secPath, fullPage: false, animations: "disabled" });
          images.push({
            src: finalUrl,
            path: secPath,
            role: "image",
            width: vp ? vp.width * dsf : undefined,
            height: vp ? vp.height * dsf : undefined,
          });
          kept++;
        } catch {
          /* one bad section must not abort the rest */
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined);
    } catch (e) {
      notes.push(`section screenshots failed (${errMsg(e)}).`);
    }

    // Resolve + download logo + hero/og images into the cache dir.
    const logos = await resolveLogos(page, finalUrl, meta, dir).catch((e) => {
      notes.push(`logo resolution failed (${errMsg(e)}).`);
      return [] as RawCrawl["logos"];
    });

    if (meta.ogImage) {
      const p = await download(page, absUrl(meta.ogImage, finalUrl), dir, "og").catch(
        () => undefined,
      );
      images.push({ src: absUrl(meta.ogImage, finalUrl), path: p, role: "og" });
    }

    const heroSrc = await findHero(page).catch(() => undefined);
    if (heroSrc) {
      const abs = absUrl(heroSrc, finalUrl);
      const p = await download(page, abs, dir, "hero").catch(() => undefined);
      images.push({ src: abs, path: p, role: "hero" });
    }

    await ctx.close().catch(() => undefined);

    const raw: RawCrawl = {
      url: target,
      finalUrl,
      title: meta.title,
      siteName: meta.siteName,
      colors,
      fonts,
      logos,
      images,
      copy,
      blocked: false,
      notes,
      capturedAt,
    };
    await writeRaw(dir, raw);
    return raw;
  } catch (e) {
    notes.push(`crawl aborted (${errMsg(e)}); returning degraded crawl.`);
    return degraded(target, notes, capturedAt);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

/* ─────────────────────────────── browser ─────────────────────────────────── */

async function launchChromium(userAgent: string): Promise<Browser> {
  // Lazy import so the module loads even where Playwright isn't installed yet
  // (e.g. type-checking in the parallel build before the integrator installs).
  const { chromium } = await import("playwright");
  void userAgent; // UA is applied per-context, not at launch.
  return chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
}

/**
 * Full-render settle. After networkidle, (1) wait for web-fonts so typeset copy
 * is in its final face, (2) scroll the page top→bottom→top to trigger lazy
 * images / intersection-observer reveals, (3) wait one more short idle so the
 * newly-loaded assets paint. Deterministic w.r.t. the DOM; no Math.random, no
 * frame timing — this is capture-time provenance work, never motion.
 */
async function settleRender(page: Page): Promise<void> {
  // Fonts ready (bounded) — keeps screenshots from showing a fallback face.
  await page
    .evaluate(() => {
      const f = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      return f?.ready ?? Promise.resolve();
    })
    .catch(() => undefined);

  // Trigger lazy-loaded content by walking the full scroll height, then return
  // to the top so the hero capture is from the natural starting position.
  await page
    .evaluate(async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const total = Math.max(
        document.body?.scrollHeight ?? 0,
        document.documentElement?.scrollHeight ?? 0,
      );
      const step = Math.max(1, window.innerHeight || 900);
      for (let y = 0; y <= total; y += step) {
        window.scrollTo(0, y);
        await sleep(60);
      }
      window.scrollTo(0, 0);
      await sleep(80);
    })
    .catch(() => undefined);

  // A brief final idle so lazy assets that just entered the DOM finish loading.
  await page
    .waitForLoadState("networkidle", { timeout: 3000 })
    .catch(() => undefined);
}

/**
 * Scroll DOWN to `targetY` in viewport-sized steps (never a single jump), so any
 * IntersectionObserver scroll-reveal between here and the target fires and paints
 * before we capture. Settles fonts/layout at the destination. Deterministic
 * w.r.t. the DOM — capture-time provenance work, never motion.
 */
async function scrollIntoViewSettled(page: Page, targetY: number): Promise<void> {
  await page
    .evaluate(async (target) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const step = Math.max(1, Math.round((window.innerHeight || 900) * 0.9));
      let y = window.scrollY;
      // Step toward the target (handles both up and down) to trip reveals.
      while (Math.abs(window.scrollY - target) > step) {
        y += y < target ? step : -step;
        window.scrollTo(0, y);
        await sleep(40);
      }
      window.scrollTo(0, target);
      // Settle: let revealed content finish its enter + lazy images decode.
      await sleep(200);
    }, targetY)
    .catch(() => undefined);
  await page.waitForTimeout(100);
}

/**
 * True if the current viewport actually contains rendered, visible content
 * (enough opaque, on-screen, non-trivial elements). Guards against emitting a
 * blank still when lazy/revealed content failed to paint at this scroll offset.
 */
async function viewportHasContent(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const vh = window.innerHeight || 900;
      const vw = window.innerWidth || 1440;
      let area = 0;
      const els = Array.from(
        document.querySelectorAll(
          "h1,h2,h3,h4,p,li,img,svg,video,canvas,button,input,table,[class*='card']",
        ),
      ).slice(0, 600);
      for (const el of els) {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= vh || r.width < 2 || r.height < 2) continue;
        const cs = getComputedStyle(el as HTMLElement);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        if (parseFloat(cs.opacity) < 0.4) continue; // mid-reveal / hidden
        const w = Math.min(r.right, vw) - Math.max(r.left, 0);
        const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (w > 0 && h > 0) area += w * h;
      }
      // Require visible content covering ≥12% of the viewport.
      return area / (vw * vh) >= 0.12;
    })
    .catch(() => true); // on error, don't suppress the shot
}

/* ─────────────────────────── in-page extractors ──────────────────────────── */

type PageMeta = {
  title?: string;
  siteName?: string;
  ogImage?: string;
  favicon?: string;
  appleTouch?: string;
  description?: string;
};

function emptyMeta(): PageMeta {
  return {};
}

async function extractMeta(page: Page): Promise<PageMeta> {
  return page.evaluate(() => {
    const pick = (sel: string, attr: string): string | undefined => {
      const el = document.querySelector(sel);
      const v = el?.getAttribute(attr) ?? undefined;
      return v && v.trim() ? v.trim() : undefined;
    };
    return {
      title: document.title || undefined,
      siteName:
        pick('meta[property="og:site_name"]', "content") ??
        pick('meta[name="application-name"]', "content"),
      ogImage:
        pick('meta[property="og:image"]', "content") ??
        pick('meta[name="twitter:image"]', "content"),
      favicon:
        pick('link[rel="icon"]', "href") ??
        pick('link[rel="shortcut icon"]', "href"),
      appleTouch: pick('link[rel="apple-touch-icon"]', "href"),
      description: pick('meta[name="description"]', "content"),
    } as PageMeta;
  });
}

/**
 * Area-weighted color sample: walk visible elements, accumulate background /
 * text / border colors weighted by on-screen area. Deterministic given the DOM.
 */
async function sampleColors(page: Page): Promise<RawCrawl["colors"]> {
  return page.evaluate(() => {
    type Acc = { color: string; weight: number; source: string };
    const out = new Map<string, Acc>();
    const add = (color: string, weight: number, source: string) => {
      if (!color) return;
      const c = color.trim().toLowerCase();
      // Drop fully transparent + the default rgba(0,0,0,0).
      if (c === "transparent" || c === "rgba(0, 0, 0, 0)") return;
      const key = `${source}|${c}`;
      const prev = out.get(key);
      if (prev) prev.weight += weight;
      else out.set(key, { color: c, weight, source });
    };

    const vw = window.innerWidth || 1440;
    const vh = window.innerHeight || 900;
    const els = Array.from(document.body?.querySelectorAll("*") ?? []).slice(0, 4000);
    for (const el of els) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // Only weight the on-screen portion (clamp to viewport).
      const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = w * h;
      if (area <= 0) continue;
      const norm = area / (vw * vh); // [0,1]
      const cs = getComputedStyle(el as HTMLElement);
      add(cs.backgroundColor, norm, "bg");
      // Text color weighted by area but only if the node has its own text.
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0,
      );
      if (hasText) add(cs.color, norm * 0.6, "text");
      if (cs.borderTopWidth !== "0px") add(cs.borderTopColor, norm * 0.05, "border");
    }

    // Brand accent often lives ONLY on a small CTA — area-weighting misses it.
    // Sample button / primary-link fills directly with a strong source weight so
    // `pickAccents` (saturation × weight) surfaces the intentional brand color.
    const ctas = Array.from(
      document.querySelectorAll(
        "button, a[class*='btn'], a[class*='button'], [role='button'], a[class*='cta']",
      ),
    ).slice(0, 200);
    for (const el of ctas) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.top + window.scrollY > 2400) continue; // above-the-fold CTAs only
      const cs = getComputedStyle(el as HTMLElement);
      add(cs.backgroundColor, 0.5, "accent");
      if (cs.borderTopWidth !== "0px") add(cs.borderTopColor, 0.25, "accent");
    }

    // CSS custom properties on :root — brand systems name their accent here.
    const rootStyle = getComputedStyle(document.documentElement);
    for (const prop of [
      "--accent",
      "--color-primary",
      "--primary",
      "--brand",
      "--color-accent",
      "--brand-primary",
    ]) {
      const v = rootStyle.getPropertyValue(prop);
      if (v && v.trim()) add(v, 0.4, "accent");
    }
    return Array.from(out.values()) as RawCrawl["colors"];
  });
}

/** Font-family usage, weighted by visible text length. Deterministic. */
async function sampleFonts(page: Page): Promise<RawCrawl["fonts"]> {
  return page.evaluate(() => {
    const out = new Map<string, number>();
    const els = Array.from(document.body?.querySelectorAll("*") ?? []).slice(0, 4000);
    for (const el of els) {
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent ?? "").trim())
        .join("");
      if (!text) continue;
      const fam = getComputedStyle(el as HTMLElement).fontFamily;
      if (!fam) continue;
      out.set(fam, (out.get(fam) ?? 0) + text.length);
    }
    return Array.from(out.entries()).map(([family, weight]) => ({ family, weight }));
  });
}

/**
 * Salient copy: headline (largest text near top), subheads, value-prop, CTA
 * buttons. Classified by tag + font-size; returns font-size + top for ranking.
 */
async function sampleCopy(page: Page, maxNodes: number): Promise<RawCrawl["copy"]> {
  return page.evaluate((max) => {
    type Kind = "headline" | "subhead" | "value-prop" | "cta" | "meta";
    type C = { text: string; kind: Kind; fontSize: number; top: number };
    const out: C[] = [];
    const seen = new Set<string>();

    const classify = (el: Element, fontSize: number): Kind => {
      const tag = el.tagName.toLowerCase();
      const role = (el.getAttribute("role") ?? "").toLowerCase();
      if (tag === "h1" || fontSize >= 34) return "headline";
      if (tag === "h2" || tag === "h3" || fontSize >= 22) return "subhead";
      if (
        tag === "button" ||
        tag === "a" ||
        role === "button" ||
        (el as HTMLElement).className?.toString().toLowerCase().includes("btn")
      ) {
        return "cta";
      }
      if (tag === "p" || tag === "li" || tag === "span") return "value-prop";
      return "meta";
    };

    const candidates = Array.from(
      document.querySelectorAll(
        "h1,h2,h3,h4,p,li,span,a,button,[role='button'],strong,blockquote",
      ),
    ).slice(0, 2000);

    for (const el of candidates) {
      // Direct text only (avoid concatenating whole subtrees).
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim())
        .join(" ")
        .trim();
      if (!text || text.length < 2) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;

      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const cs = getComputedStyle(el as HTMLElement);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const fontSize = parseFloat(cs.fontSize) || 16;

      seen.add(key);
      out.push({
        text,
        kind: classify(el, fontSize),
        fontSize,
        top: r.top + window.scrollY,
      });
      if (out.length >= max) break;
    }
    return out as C[];
  }, maxNodes);
}

/** Find the largest visible hero <img> in the upper region of the page. */
async function findHero(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    let best: { src: string; area: number } | null = null;
    const imgs = Array.from(document.querySelectorAll("img")).slice(0, 300);
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      const top = r.top + window.scrollY;
      if (top > 1200) continue; // upper region only
      const area = r.width * r.height;
      if (area < 40_000) continue; // ignore icons/thumbs
      const src = img.currentSrc || img.src;
      if (!src) continue;
      if (!best || area > best.area) best = { src, area };
    }
    return best?.src;
  });
}

/**
 * Find major below-the-fold content sections to frame as screenshots. Picks
 * large, distinct full-width blocks (`section`, landmarks, big content divs)
 * past the first fold. For each, compute a `scrollY` that centers the section's
 * CONTENT (the bounding box of its meaningful descendants) in the viewport, and
 * SKIP sections that are mostly empty whitespace — those produced blank stills.
 * Deterministic given the DOM (sorted by `top`).
 */
async function findSections(
  page: Page,
  max: number,
): Promise<{ top: number; height: number; scrollY: number }[]> {
  return page.evaluate((maxN) => {
    const vh = window.innerHeight || 900;
    const vw = window.innerWidth || 1440;
    const maxScroll = Math.max(
      0,
      (document.documentElement?.scrollHeight ?? 0) - vh,
    );
    const cands = Array.from(
      document.querySelectorAll("section, main > div, [role='region'], article"),
    );
    const out: { top: number; height: number; scrollY: number; density: number }[] = [];

    for (const el of cands) {
      const r = (el as HTMLElement).getBoundingClientRect();
      const top = r.top + window.scrollY;
      if (top < vh * 0.8) continue;
      if (r.height < vh * 0.4) continue;
      if (r.width < vw * 0.5) continue;

      // Content box: union of rects of meaningful descendants (text, media,
      // controls). This collapses leading/trailing padding so we frame the
      // real content, and lets us measure how "full" the section is.
      let cTop = Infinity;
      let cBot = -Infinity;
      let filled = 0;
      const kids = el.querySelectorAll(
        "h1,h2,h3,h4,h5,p,li,img,svg,video,button,a,input,canvas,table,pre,code,figure,[class*='card']",
      );
      for (const k of Array.from(kids).slice(0, 400)) {
        const kr = (k as HTMLElement).getBoundingClientRect();
        if (kr.width <= 1 || kr.height <= 1) continue;
        const kt = kr.top + window.scrollY;
        cTop = Math.min(cTop, kt);
        cBot = Math.max(cBot, kt + kr.height);
        filled += Math.min(kr.width, vw) * Math.min(kr.height, vh);
      }
      const hasContent = cTop !== Infinity;
      const contentTop = hasContent ? cTop : top;
      const contentBot = hasContent ? cBot : top + r.height;
      const contentMid = (contentTop + contentBot) / 2;
      // Density = filled content area relative to one viewport. Skip sections
      // that are nearly empty (the blank-still cause).
      const density = filled / (vw * vh);
      if (density < 0.18) continue;

      // Center the content in the viewport, clamped to the scrollable range.
      const scrollY = Math.max(0, Math.min(maxScroll, Math.round(contentMid - vh / 2)));

      // Dedupe sections whose framed scroll target is within ~half a viewport.
      if (out.some((o) => Math.abs(o.scrollY - scrollY) < vh * 0.5)) continue;
      out.push({ top, height: r.height, scrollY, density });
    }
    out.sort((a, b) => a.top - b.top);
    return out.slice(0, maxN).map(({ top, height, scrollY }) => ({ top, height, scrollY }));
  }, max);
}

/* ──────────────────────────── logo resolution ────────────────────────────── */

async function resolveLogos(
  page: Page,
  finalUrl: string,
  meta: PageMeta,
  dir: string,
): Promise<RawCrawl["logos"]> {
  const logos: RawCrawl["logos"] = [];

  // Header wordmark: prefer an inline <svg> (crisp vector), else an <img>, both
  // scoped to <header>/[role=banner]/nav near the top-left. Returns either the
  // img src or a standalone SVG document string.
  const headerLogo = await page
    .evaluate(() => {
      const scopes = Array.from(
        document.querySelectorAll("header, [role='banner'], nav"),
      );

      // 1. Inline SVG wordmark — serialize to a standalone .svg document.
      // Score every plausible top-left SVG and keep the BEST, rather than the
      // first. A 12×12 nav glyph and the real wordmark both pass a boolean
      // "looksLogo" test; without scoring we grabbed the tiny icon. Score
      // rewards larger area + wordmark aspect (wider-than-tall) + explicit
      // logo class/aria, so the brand mark wins over decorative icons.
      let bestSvg:
        | { markup: string; w: number; h: number; score: number }
        | null = null;
      for (const scope of scopes) {
        const svgs = Array.from(scope.querySelectorAll("svg"));
        for (const svg of svgs) {
          const r = (svg as Element).getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          if (r.top >= 200) continue;
          // Reject icon-sized marks and oversized illustrations.
          if (r.height < 14 || r.height > 96) continue;
          if (r.width < 16 || r.width > 480) continue;
          const cls = (svg.getAttribute("class") ?? "").toLowerCase();
          const aria = (svg.getAttribute("aria-label") ?? "").toLowerCase();
          const named =
            cls.includes("logo") ||
            aria.includes("logo") ||
            aria.includes("home") ||
            aria.includes(document.title.split(/[\s|—-]/)[0].toLowerCase());
          const topLeft = r.left < 400 && r.top < 160;
          if (!named && !topLeft) continue;
          const aspect = r.width / r.height; // wordmarks are wide
          let score = r.width * r.height; // bigger = more likely the mark
          if (aspect >= 2) score *= 1.8; // wordmark aspect
          else if (aspect < 1.2) score *= 0.5; // square = probably an icon
          if (named) score *= 1.6;
          if (r.left < 240) score *= 1.15; // far-left header slot
          if (bestSvg && score <= bestSvg.score) continue;
          let markup = svg.outerHTML;
          if (!/xmlns=/.test(markup)) {
            markup = markup.replace(
              /^<svg/i,
              '<svg xmlns="http://www.w3.org/2000/svg"',
            );
          }
          bestSvg = {
            markup,
            w: Math.round(r.width),
            h: Math.round(r.height),
            score,
          };
        }
      }
      if (bestSvg) {
        return {
          kind: "svg" as const,
          markup: bestSvg.markup,
          w: bestSvg.w,
          h: bestSvg.h,
        };
      }

      // 2. <img> wordmark.
      for (const scope of scopes) {
        const imgs = Array.from(scope.querySelectorAll("img"));
        for (const img of imgs) {
          const r = img.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const cls = (img.getAttribute("class") ?? "").toLowerCase();
          const alt = (img.getAttribute("alt") ?? "").toLowerCase();
          const looksLogo =
            cls.includes("logo") ||
            alt.includes("logo") ||
            (r.top < 160 && r.left < 400 && r.height <= 80);
          if (looksLogo) return { kind: "img" as const, src: img.currentSrc || img.src };
        }
      }
      return undefined;
    })
    .catch(() => undefined);

  if (headerLogo?.kind === "svg" && headerLogo.markup) {
    try {
      const svgPath = path.join(dir, "logo.svg");
      await fs.writeFile(svgPath, headerLogo.markup, "utf8");
      logos.push({
        src: finalUrl,
        path: svgPath,
        kind: "svg",
        width: headerLogo.w,
        height: headerLogo.h,
      });
    } catch {
      /* best-effort */
    }
  } else if (headerLogo?.kind === "img" && headerLogo.src) {
    const abs = absUrl(headerLogo.src, finalUrl);
    const p = await download(page, abs, dir, "logo-header").catch(() => undefined);
    logos.push({ src: abs, path: p, kind: "header-img" });
  }

  if (meta.ogImage) {
    logos.push({ src: absUrl(meta.ogImage, finalUrl), kind: "og-image" });
  }
  if (meta.appleTouch) {
    const abs = absUrl(meta.appleTouch, finalUrl);
    const p = await download(page, abs, dir, "apple-touch").catch(() => undefined);
    logos.push({ src: abs, path: p, kind: "apple-touch-icon" });
  }
  // Favicon: explicit link, else conventional /favicon.ico.
  const favHref = meta.favicon ?? "/favicon.ico";
  const favAbs = absUrl(favHref, finalUrl);
  const favPath = await download(page, favAbs, dir, "favicon").catch(() => undefined);
  logos.push({ src: favAbs, path: favPath, kind: "favicon" });

  return logos;
}

/**
 * Download a remote asset through the page's request context (shares cookies /
 * UA / referer), writing to the cache dir. Returns the local path or throws.
 */
async function download(
  page: Page,
  url: string,
  dir: string,
  baseName: string,
): Promise<string | undefined> {
  if (!url || url.startsWith("data:")) return undefined;
  const resp = await page.request.get(url, { timeout: 10_000 });
  if (!resp.ok()) return undefined;
  const buf = await resp.body();
  if (!buf || buf.length === 0) return undefined;
  const ext = extFromContentType(resp.headers()["content-type"]) ?? extFromUrl(url) ?? "img";
  const file = path.join(dir, `${baseName}.${ext}`);
  await fs.writeFile(file, buf);
  return file;
}

/* ────────────────────────── robots best-effort ───────────────────────────── */

/**
 * Best-effort robots check. Returns:
 *   true  → allowed (or no rule)
 *   false → a matching Disallow blocks this path for our UA / '*'
 *   null  → robots.txt unreadable (treat as allowed, but note it)
 *
 * Minimal, dependency-free parser: honors User-agent groups for our token and
 * '*', longest-match Allow/Disallow precedence.
 */
export async function robotsAllows(
  targetUrl: string,
  userAgent: string,
): Promise<boolean | null> {
  let robotsTxt: string;
  let pathName: string;
  try {
    const u = new URL(targetUrl);
    pathName = u.pathname || "/";
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const res = await fetch(robotsUrl, {
      headers: { "user-agent": userAgent },
      // node fetch: bound the wait so a hung origin doesn't stall ingest.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    robotsTxt = await res.text();
  } catch {
    return null;
  }
  return evaluateRobots(robotsTxt, pathName, uaToken(userAgent));
}

/** Lowercased product token from a UA string (e.g. "yupchabrandbot"). */
function uaToken(userAgent: string): string {
  const m = userAgent.match(/([a-z][a-z0-9-]*bot)/i);
  return (m?.[1] ?? userAgent).toLowerCase();
}

/** Pure robots evaluator — exported for unit testing; no I/O. */
export function evaluateRobots(
  robotsTxt: string,
  pathName: string,
  token: string,
): boolean {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  // Build agent → rules groups.
  type Rule = { allow: boolean; pattern: string };
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const line of lines) {
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      current.rules.push({ allow: field === "allow", pattern: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  // Select the most specific matching group: our token > '*'.
  const forToken = groups.find((g) => g.agents.includes(token));
  const forStar = groups.find((g) => g.agents.includes("*"));
  const group = forToken ?? forStar;
  if (!group) return true;

  // Longest-match precedence; on equal length, Allow wins (standard).
  let decision: { allow: boolean; len: number } | null = null;
  for (const rule of group.rules) {
    if (rule.pattern === "") continue; // empty Disallow = allow all
    if (matchesRobotsPattern(pathName, rule.pattern)) {
      const len = rule.pattern.length;
      if (!decision || len > decision.len || (len === decision.len && rule.allow)) {
        decision = { allow: rule.allow, len };
      }
    }
  }
  return decision ? decision.allow : true;
}

/** robots.txt path matching with `*` wildcard and `$` end-anchor. */
function matchesRobotsPattern(pathName: string, pattern: string): boolean {
  // Translate robots glob to a regex, escaping everything else.
  let anchored = false;
  let p = pattern;
  if (p.endsWith("$")) {
    anchored = true;
    p = p.slice(0, -1);
  }
  const re = p
    .split("*")
    .map((seg) => seg.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const rx = new RegExp("^" + re + (anchored ? "$" : ""));
  return rx.test(pathName);
}

/* ───────────────────────────── degraded paths ────────────────────────────── */

/** Fully-degraded crawl: no browser data, safe defaults downstream. */
function degraded(url: string, notes: string[], capturedAt: string): RawCrawl {
  return {
    url,
    finalUrl: url,
    colors: [],
    fonts: [],
    logos: [],
    images: [],
    copy: [],
    blocked: true,
    notes,
    capturedAt,
  };
}

/**
 * Metadata-only crawl (no chromium): fetch the HTML directly and regex out
 * title / og:image / favicon so we still return *something* useful when the
 * browser can't launch.
 */
async function metadataOnly(
  url: string,
  opts: typeof DEFAULTS,
  notes: string[],
  capturedAt: string,
): Promise<RawCrawl> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": opts.userAgent },
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) {
      notes.push(`metadata fetch HTTP ${res.status}.`);
      return degraded(url, notes, capturedAt);
    }
    const html = await res.text();
    const finalUrl = res.url || url;
    const grab = (re: RegExp): string | undefined => html.match(re)?.[1]?.trim();
    const title = grab(/<title[^>]*>([^<]+)<\/title>/i);
    const siteName = grab(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    );
    const ogImage = grab(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    );
    const favicon = grab(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    );

    const images: RawCrawl["images"] = [];
    const logos: RawCrawl["logos"] = [];
    if (ogImage) {
      const abs = absUrl(ogImage, finalUrl);
      images.push({ src: abs, role: "og" });
      logos.push({ src: abs, kind: "og-image" });
    }
    logos.push({ src: absUrl(favicon ?? "/favicon.ico", finalUrl), kind: "favicon" });

    // Cheap headline harvest from <h1> tags.
    const copy: RawCrawl["copy"] = [];
    const h1 = grab(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, " ").trim();
    if (h1) copy.push({ text: h1, kind: "headline", fontSize: 40, top: 0 });
    if (siteName) copy.push({ text: siteName, kind: "meta", fontSize: 16, top: 0 });

    return {
      url,
      finalUrl,
      title,
      siteName,
      colors: [],
      fonts: [],
      logos,
      images,
      copy,
      blocked: false,
      notes,
      capturedAt,
    };
  } catch (e) {
    notes.push(`metadata-only fetch failed (${errMsg(e)}).`);
    return degraded(url, notes, capturedAt);
  }
}

/* ───────────────────────────────── cache ─────────────────────────────────── */

async function readCachedKit(dir: string): Promise<BrandKit | null> {
  try {
    const buf = await fs.readFile(path.join(dir, "brandkit.json"), "utf8");
    return JSON.parse(buf) as BrandKit;
  } catch {
    return null;
  }
}

async function writeCachedKit(dir: string, kit: BrandKit): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "brandkit.json"), JSON.stringify(kit, null, 2));
  } catch {
    // Cache write is best-effort; a failure must not break the crawl.
  }
}

async function writeRaw(dir: string, raw: RawCrawl): Promise<void> {
  try {
    await fs.writeFile(path.join(dir, "raw.json"), JSON.stringify(raw, null, 2));
  } catch {
    /* best-effort */
  }
}

/* ───────────────────────────────── utils ─────────────────────────────────── */

function absUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extFromContentType(ct?: string): string | undefined {
  if (!ct) return undefined;
  const t = ct.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/gif": "gif",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
    "image/avif": "avif",
  };
  return map[t];
}

function extFromUrl(url: string): string | undefined {
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return m?.[1]?.toLowerCase();
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Re-export the BrandKit types/normalizer so callers can `import { ... } from "./crawl"`.
export {
  normalizeBrandKit,
  type BrandKit,
  type RawCrawl,
  type CopyCandidate,
  type BrandScreen,
  type BrandLogo,
  type PaletteShape,
} from "./brandkit";
