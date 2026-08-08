/**
 * web/eslint.config.mjs — ESLint for the Next.js web surface.
 *
 * The repo root extends `@remotion/eslint-config-flat`, whose rules govern
 * Remotion COMPOSITIONS (they forbid native `<video>`/`<img>` in favor of the
 * `remotion`/`@remotion/media` tags that sync to the video timeline). This `web/`
 * app is a plain browser frontend, NOT a composition — those media tags do not
 * apply and would be wrong here. So we extend the base config but turn off the
 * composition-only media-tag rule for this package.
 */
import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    rules: {
      // Native <video>/<img> are correct in a web UI (not a Remotion timeline).
      "@remotion/warn-native-media-tag": "off",
    },
  },
];
