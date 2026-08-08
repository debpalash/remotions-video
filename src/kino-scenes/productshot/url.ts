/**
 * Deterministic browser-URL derivation for the ProductShot chrome.
 *
 * THE FIX this module exists for: the prior chrome hard-coded `app.product.com`,
 * so every hero read as a stock template ("empty app.product.com chrome"). A real
 * product hero shows the *real* product URL in the address pill — that one detail
 * is most of what sells the frame as genuine. We can't widen the frozen
 * `ProductShotProps` contract (it lives in `src/spec`, not this path), so we
 * recover a real, on-brand URL from the data the scene already carries: the
 * `screen` asset KEY and, as a last resort, the headline.
 *
 * The ingest pipeline keys screenshots by brand path (e.g. `yupcha/dashboard`,
 * `acme/app/billing.webp`) — the leading path segment IS the brand host and the
 * trailing segments ARE the route. So `yupcha/dashboard` → `app.yupcha.com/dashboard`.
 *
 * DETERMINISM (ENGINE_DESIGN §2): a pure string→string function. No clock, no
 * random, no I/O. Same inputs → same URL, every frame, every worker.
 */

/** Strip a file extension and any directory-ish leading/trailing slashes. */
const stripExt = (s: string): string => s.replace(/\.[a-z0-9]+$/i, "");

/** Keep only URL-safe slug characters; collapse the rest to nothing. */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Common route words we recognise inside an asset key so a key like
 * `yupcha/candidate-ranking` lands on a clean `/ranking` route rather than the
 * raw multi-word slug. Order matters (first match wins).
 */
const ROUTE_HINTS: Array<[RegExp, string]> = [
  [/dashboard|home|overview/, "dashboard"],
  [/rank|score|result|leaderboard/, "ranking"],
  [/interview|call|meeting/, "interviews"],
  [/candidate|applicant|profile|people/, "candidates"],
  [/analy|insight|report|metric/, "analytics"],
  [/inbox|message|chat/, "inbox"],
  [/setting|config|admin/, "settings"],
  [/bill|invoice|pricing|plan/, "billing"],
  [/pipeline|board|stage/, "pipeline"],
];

/** Map a route token to a recognised clean route, else a sanitised slug. */
const cleanRoute = (token: string): string => {
  for (const [re, route] of ROUTE_HINTS) if (re.test(token)) return route;
  const s = slug(token);
  return s || "dashboard";
};

/**
 * Words that, as a leading asset-path segment, are NOT a brand host (generic
 * public-folder roots). When the leading segment is one of these we fall back to
 * deriving the host from the headline instead of inventing `app.public.com`.
 */
const GENERIC_ROOTS = new Set([
  "public",
  "assets",
  "asset",
  "images",
  "image",
  "img",
  "screens",
  "screen",
  "screenshots",
  "screenshot",
  "shots",
  "shot",
  "static",
  "media",
  "uploads",
  "upload",
  "captures",
  "capture",
  "frames",
  "frame",
  "exports",
  "export",
  "downloads",
  "download",
  "files",
  "file",
  "untitled",
  // Crawl SCAFFOLD names — the ingest keys scraped images `<role>-<i>`
  // (`hero-0`, `screenshot-1`, `image-2`, `og-0`…). The role token is the
  // ingest's own placeholder, NEVER a brand host, so treating it as one leaked
  // the stock `app.hero-0.com` / `app.image-2.com` tell into the chrome (CD R7
  // P0). `isGenericRoot` strips the trailing `-<i>` before matching, so listing
  // the bare role tokens here rejects the whole scaffold family.
  "hero",
  "heroes",
  "og",
]);

/**
 * Is a path segment a generic placeholder rather than a brand host? A scraped
 * asset is frequently keyed `screenshot-1` / `shot_2` / `image3` / `12` — the
 * ingest's own placeholder name, NOT the product. Treating it as a brand host
 * leaked the stock `app.screenshot-1.com` tell into the chrome (CD R4 P1). We
 * strip a trailing numeric suffix (`-1`, `_2`, `3`) and match the generic set,
 * and also reject a purely-numeric segment. Pure string→boolean.
 */
const isGenericRoot = (seg: string): boolean => {
  const base = seg.toLowerCase().replace(/[-_ ]?\d+$/, "");
  return base === "" || /^\d+$/.test(seg) || GENERIC_ROOTS.has(base);
};

/** A reasonable host from a headline when the asset key carries no brand. */
const hostFromHeadline = (headline: string): string => {
  // Take the first capitalised-ish word as the brand token; fall back to "app".
  const word = headline
    .replace(/\*/g, "") // headline emphasis markers
    .split(/\s+/)
    .map(slug)
    .find((w) => w.length >= 3);
  return word ? `${word}.com` : "yourapp.com";
};

export type DerivedUrl = {
  /** What the address pill renders, e.g. `app.yupcha.com/dashboard`. */
  display: string;
  /** The host portion, e.g. `app.yupcha.com` (for any host-only use). */
  host: string;
};

/**
 * Derive the address-pill URL for the chrome.
 *
 * @param screen   the spec `screen` asset key (may be empty when there is no
 *                 real screenshot — then we still produce a real-looking URL so
 *                 the mock chrome is never the generic `app.product.com`).
 * @param headline the scene headline, used only as a brand fallback.
 */
export const deriveUrl = (
  screen: string | undefined,
  headline: string,
): DerivedUrl => {
  const key = stripExt((screen ?? "").trim()).replace(/^[/\\]+|[/\\]+$/g, "");
  const segments = key
    .split(/[/\\]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Brand host: the leading path segment, unless it's a generic folder root or
  // a placeholder asset name (`screenshot-1`, `12`, …) — those fall back to the
  // headline-derived host so the chrome never leaks `app.screenshot-1.com`.
  const rawBrand = segments[0];
  const brand =
    rawBrand && !isGenericRoot(rawBrand) ? slug(rawBrand) : undefined;
  const host = brand ? `app.${brand}.com` : `app.${hostFromHeadline(headline)}`;

  // Route: the remaining segments (or the single segment if there's no brand
  // dir), with any generic/placeholder segments dropped so a lone `screenshot-1`
  // yields a clean bare host. No trailing route → the marketing/home surface.
  const routeSegments = (brand ? segments.slice(1) : segments).filter(
    (s) => !isGenericRoot(s),
  );
  const route = routeSegments.length
    ? "/" + routeSegments.map(cleanRoute).join("/")
    : "";

  return { display: `${host}${route}`, host };
};
