/**
 * KINETIC TYPE — text splitting + emphasis parsing.
 *
 * Pure helpers that turn a copy string into the typed token stream the kinetic
 * primitives choreograph. Everything here is deterministic and side-effect free:
 * the same string always splits into the same tokens, so two renders of the same
 * frame are byte-identical (ENGINE_DESIGN §2).
 *
 * Two split granularities:
 *  - WORD tokens carry an `emph` flag (lifted from the `*marked*` convention the
 *    rest of the kit already uses for gradient emphasis — `kit.tsx:Headline`).
 *  - GLYPH tokens are the per-character units the spring stagger animates, while
 *    preserving word boundaries so words never break mid-air across a wrap.
 *
 * The `*marked*` convention: a span wrapped in single asterisks is the ONE
 * emphasis affordance copy controls (gradient / accent word). Asterisks never
 * render; they only flip the `emph` flag. This keeps emphasis on-token — copy
 * cannot leak a raw color, only a marked span (`SAAS_ROADMAP.md §4` anti-slop).
 */

/* -------------------------------------------------------------------------- */
/*  Word tokens                                                                */
/* -------------------------------------------------------------------------- */

export type WordToken = {
  /** The visible word text (asterisks stripped). */
  readonly text: string;
  /** True when the word sat inside a `*…*` emphasis span. */
  readonly emph: boolean;
  /** Running word index across the whole line (for stagger delay). */
  readonly index: number;
};

/**
 * Split a line into emphasis-aware word tokens. `*marked words*` flip `emph`;
 * the asterisks are removed. Multiple words inside one span all inherit `emph`.
 *
 * @example splitWords("Hiring eats *your week*")
 *   → [{text:"Hiring",emph:false}, {text:"eats",emph:false},
 *      {text:"your",emph:true}, {text:"week",emph:true}]
 */
export const splitWords = (line: string): WordToken[] => {
  const raw: { text: string; emph: boolean }[] = [];
  // Segments alternate outside/inside the asterisk pairs, like kit.tsx:Headline.
  const segments = line.split(/\*(.+?)\*/);
  segments.forEach((seg, segIdx) => {
    if (seg.length === 0) return;
    const emph = segIdx % 2 === 1;
    for (const w of seg.split(/\s+/)) {
      if (w.length === 0) continue;
      raw.push({ text: w, emph });
    }
  });

  // DASH GLUE (CD #2: kinetic reveals stranded trailing em-dashes — "Boost your
  // chances –"). A clause-separating dash (" – " / " — ") splits on whitespace
  // into its OWN token, which a wrap can leave dangling at the end of a line. We
  // fold a standalone dash into the FOLLOWING word so the dash leads the next
  // clause ("– and fix instantly") and can never be the last token on a line; a
  // truly trailing dash (no next word) folds into the PREVIOUS word so it still
  // never stands alone. Pure — same string always folds identically.
  const isDash = (t: string): boolean => /^[–—-]+$/.test(t);
  const folded: { text: string; emph: boolean }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const tok = raw[i];
    if (isDash(tok.text)) {
      const next = raw[i + 1];
      if (next) {
        next.text = `${tok.text} ${next.text}`;
        continue; // dash now leads `next`
      }
      if (folded.length > 0) {
        const prev = folded[folded.length - 1];
        prev.text = `${prev.text} ${tok.text}`;
        continue; // dash absorbed by the previous word
      }
    }
    folded.push({ ...tok });
  }

  return folded.map((t, index) => ({ text: t.text, emph: t.emph, index }));
};

/* -------------------------------------------------------------------------- */
/*  Glyph tokens                                                               */
/* -------------------------------------------------------------------------- */

export type GlyphToken = {
  /** A single rendered character (may be a space inside a word — see below). */
  readonly char: string;
  /** Word this glyph belongs to (so words wrap as a unit). */
  readonly wordIndex: number;
  /** Glyph position within its word. */
  readonly glyphInWord: number;
  /** Running glyph index across the whole line (drives the stagger clock). */
  readonly index: number;
  /** Inherited emphasis flag from the parent word. */
  readonly emph: boolean;
};

export type GlyphWord = {
  readonly wordIndex: number;
  readonly emph: boolean;
  readonly glyphs: GlyphToken[];
};

/**
 * Split a line into per-word groups of per-glyph tokens, emphasis-aware.
 *
 * Returns words (not a flat glyph list) so the renderer can keep each word in an
 * `inline-block` that never breaks mid-word on wrap, while still animating each
 * glyph on its own delayed clock. The flat `index` is preserved on every glyph
 * for a single source-of-truth stagger stride across the line.
 *
 * Uses `Array.from` so surrogate-pair characters (emoji, etc.) count as one
 * glyph rather than two — deterministic and locale-independent.
 */
export const splitGlyphs = (line: string): GlyphWord[] => {
  const words = splitWords(line);
  let running = 0;
  return words.map((w) => {
    const chars = Array.from(w.text);
    const glyphs: GlyphToken[] = chars.map((char, glyphInWord) => ({
      char,
      wordIndex: w.index,
      glyphInWord,
      index: running++,
      emph: w.emph,
    }));
    return { wordIndex: w.index, emph: w.emph, glyphs };
  });
};

/** Total glyph count of a line (for closed-form last-glyph timing). */
export const glyphCount = (line: string): number =>
  splitGlyphs(line).reduce((n, w) => n + w.glyphs.length, 0);

/* -------------------------------------------------------------------------- */
/*  Deterministic per-index jitter (NO Math.random)                            */
/* -------------------------------------------------------------------------- */

/**
 * Hash an integer index → a stable `[0,1)` value. This is the "seeded random"
 * the dossier mandates: same index → same value, forever, so baseline drift and
 * tracking jitter are choreographed-but-organic without ever touching
 * `Math.random` (which would vary per shard / per remount).
 *
 * Integer hash (Wang/triple-shift mix), then normalized to the unit interval.
 */
export const hash01 = (index: number, salt = 0): number => {
  let h = (index ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** Signed jitter in `[-1,1]` from a hashed index — for symmetric drift. */
export const jitter = (index: number, salt = 0): number =>
  hash01(index, salt) * 2 - 1;
