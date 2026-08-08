/**
 * src/ingest — Playwright brand ingest.
 *
 * Public surface:
 *   ingest(url)            → cached, normalized BrandKit (the main entrypoint)
 *   crawl(url)             → raw, un-normalized crawl payload
 *   normalizeBrandKit(...) → pure RawCrawl → BrandKit
 *   hashUrl(url)           → the cache key / brandKitId
 */
export {
  ingest,
  crawl,
  hashUrl,
  robotsAllows,
  evaluateRobots,
  type CrawlOptions,
} from "./crawl";

// REAL-ASSET OVERRIDE — dropped screenshots in `brand-assets/<slug>/` take
// precedence over scraped/empty screens (SAAS_ROADMAP §3: uploads beat scrape).
export {
  applyRealAssetOverride,
  loadRealAssetScreens,
  stageRealAssets,
  stageRealAssetKeys,
  slugCandidates,
  type RealAssetOptions,
} from "./realassets";

export {
  normalizeBrandKit,
  buildPalette,
  rankCopy,
  normalizeFonts,
  inferVoice,
  parseColor,
  luminance,
  toHex,
  DEFAULT_PALETTE,
  type BrandKit,
  type RawCrawl,
  type PaletteShape,
  type CopyCandidate,
  type BrandScreen,
  type BrandLogo,
  type RGB,
} from "./brandkit";
