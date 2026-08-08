/**
 * web/lib/assets.server.ts — safe serving of pipeline outputs (stills + mp4).
 *
 * The pipeline writes mp4s into `<repo>/out/` and stills into `<repo>/out/web/`
 * (a still path the storyboard route creates). The browser can't read those
 * absolute paths, so routes convert an absolute output path → a relative key and
 * the `/api/asset` route streams it back. Serving is confined to the `out/` tree
 * (path-traversal hardened) so no arbitrary file can be read.
 */
import "server-only";

import { resolve, relative, isAbsolute, sep, extname } from "node:path";

/** Repo root = one level above `web/`. */
export const REPO_ROOT = resolve(process.cwd(), "..");
/** Only files under here are servable. */
export const OUT_ROOT = resolve(REPO_ROOT, "out");
/** Where the web storyboard route writes its per-scene stills. */
export const WEB_STILLS_DIR = resolve(OUT_ROOT, "web");

/**
 * Convert an absolute pipeline output path into the relative key the browser
 * uses (`/api/asset?p=<key>`). Returns `null` when the path escapes `out/`.
 */
export function toAssetKey(absPath: string): string | null {
  const abs = isAbsolute(absPath) ? absPath : resolve(REPO_ROOT, absPath);
  const rel = relative(OUT_ROOT, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  // Normalize to forward slashes for a stable URL.
  return rel.split(sep).join("/");
}

/** Build the browser URL for an absolute output path (or `null` if unservable). */
export function assetUrl(absPath: string): string | null {
  const key = toAssetKey(absPath);
  return key ? `/api/asset?p=${encodeURIComponent(key)}` : null;
}

/**
 * Resolve a request's `p` key back to an absolute path, REJECTING anything that
 * escapes `out/`. Returns `null` for traversal attempts.
 */
export function resolveAssetKey(key: string): string | null {
  if (!key || key.includes("\0")) return null;
  const abs = resolve(OUT_ROOT, key);
  const rel = relative(OUT_ROOT, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  return abs;
}

/** Minimal content-type table for the asset types the pipeline emits. */
export function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".mp4":
      return "video/mp4";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webm":
      return "video/webm";
    case ".vtt":
      return "text/vtt";
    default:
      return "application/octet-stream";
  }
}
