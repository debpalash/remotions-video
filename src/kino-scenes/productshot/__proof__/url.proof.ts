/**
 * PROOF for the ProductShot URL derivation (`../url.ts`).
 *
 * The rebuild's headline fix is killing the stock `app.product.com` chrome by
 * recovering the REAL product URL from the `screen` asset key. This proof asserts:
 *   1. DETERMINISM — same input → byte-identical URL (the engine §2 contract,
 *      since the chrome is captured per-frame across parallel workers).
 *   2. It NEVER emits the banned stock placeholder `app.product.com`.
 *   3. Brand path → host + clean route (`yupcha/dashboard` → `app.yupcha.com/dashboard`).
 *   4. Generic folder roots don't become a brand host; headline fallback kicks in.
 *   5. No-screen case still yields a real-looking, brand-derived URL (mock chrome).
 *
 * Pure assert harness — no DOM, no GPU, no framework. Run:
 *   tsx src/kino-scenes/productshot/__proof__/url.proof.ts
 */
import assert from "node:assert/strict";

import { deriveUrl } from "../url";

let passed = 0;
function ok(name: string, cond: boolean, detail?: string): void {
  assert.ok(cond, `${name}${detail ? ` — ${detail}` : ""}`);
  passed++;
}

const HEAD = "Hiring on *autopilot*";

// 1 — determinism: two calls are identical.
{
  const a = deriveUrl("yupcha/dashboard", HEAD);
  const b = deriveUrl("yupcha/dashboard", HEAD);
  ok("determinism", a.display === b.display && a.host === b.host, a.display);
}

// 2 — never the stock placeholder, across a spread of inputs.
{
  const cases: Array<[string | undefined, string]> = [
    ["yupcha/dashboard.webp", HEAD],
    ["", HEAD],
    [undefined, HEAD],
    ["public/screens/home.png", "Acme ships faster"],
    ["resubird/score", "ResuBird"],
  ];
  for (const [screen, head] of cases) {
    const { display } = deriveUrl(screen, head);
    ok(
      `no-stock-placeholder(${screen ?? "∅"})`,
      !/app\.product\.com/i.test(display),
      display,
    );
  }
}

// 3 — brand path → host + clean route.
{
  const { display, host } = deriveUrl("yupcha/dashboard", HEAD);
  ok("brand-host", host === "app.yupcha.com", host);
  ok("brand-route", display === "app.yupcha.com/dashboard", display);
}

// 3b — multi-word route token collapses to a recognised clean route.
{
  const { display } = deriveUrl("yupcha/candidate-ranking.webp", HEAD);
  ok("clean-route", display === "app.yupcha.com/ranking", display);
}

// 4 — generic folder root is NOT treated as a brand; headline fallback used.
{
  const { host } = deriveUrl("screens/home.png", "Acme ships faster");
  ok("generic-root-fallback", host === "app.acme.com", host);
}

// 5 — no screen at all still yields a real, brand-derived URL (mock chrome).
{
  const { display } = deriveUrl(undefined, "Yupcha hires faster");
  ok(
    "no-screen-real-url",
    /^app\.[a-z0-9.-]+\.com/.test(display),
    display,
  );
}

// 6 — nested brand path keeps a multi-segment route.
{
  const { display } = deriveUrl("acme/app/billing", HEAD);
  ok("nested-route", display === "app.acme.com/app/billing", display);
}

// 7 — placeholder asset names (`screenshot-1`, numeric) never leak as a brand
//     host; they fall back to the headline-derived host (no app.screenshot-1.com).
{
  for (const screen of ["screenshot-1.png", "shot_2", "image3", "12"]) {
    const { display, host } = deriveUrl(screen, "ResuBird beats the ATS");
    ok(
      `placeholder-no-leak(${screen})`,
      !/screenshot|shot|image|^app\.\d/i.test(host) && host === "app.resubird.com",
      display,
    );
  }
}

// eslint-disable-next-line no-console
console.log(`url.proof: ${passed} assertions passed`);
