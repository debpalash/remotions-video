/**
 * Minimal ambient typings for `react-dom/client` — a fallback used ONLY until
 * `@types/react-dom` is installed (returned in this agent's `deps[]`; the
 * integrator installs it). These `declare module` blocks merge harmlessly with
 * the real `@types/react-dom` declarations when present, so this file does not
 * need removing.
 *
 * Scoped to this agent's path (`src/render/host`). Covers just the surface the
 * host entry uses: `createRoot(...).render()`.
 */
declare module "react-dom/client" {
  import type * as React from "react";

  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }

  export function createRoot(
    container: Element | DocumentFragment,
    options?: unknown,
  ): Root;

  export function hydrateRoot(
    container: Element | Document,
    initialChildren: React.ReactNode,
    options?: unknown,
  ): Root;
}
