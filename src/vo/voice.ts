// Voice selection + the "less mechanical" default read.
//
// The CLAUDE.md profile ids (fd085cf0 / feat_20_the_luxe) are STALE — the live
// OmniVoice `/profiles` endpoint is the source of truth. This module captures
// the AUDITION of the four real profiles (synth of the same Yupcha hook line,
// measured with ffmpeg) and freezes the winner + a deliberate, warm style as the
// configurable defaults the VO pipeline uses.
//
// Audition (hook: "Hiring eats your week. Yupcha runs it without you.", seed 42):
//   fa99b1a5  The Companion  female, mid-age, moderate pitch, Canadian   3.06s  LRA 20.0 LU  crest 4.81
//   demo0001  Demo Voice     neutral reference                          3.28s  LRA 20.0 LU  crest 4.65
//   e67ce61e  The Upbeat     female, young, high pitch, American         2.84s  LRA  0.0 LU  crest 6.80
//   7b059bea  The Upbeat     female, young, high pitch, American         2.85s  LRA  0.0 LU  crest 5.50
//
// LRA (loudness range) is a direct proxy for prosodic variation. The two
// "Upbeat" profiles measure LRA 0.0 LU — a flat, even loudness contour that
// reads as the staccato/mechanical voice the user flagged. The Companion and the
// neutral Demo both measure LRA 20.0 LU (wide, human dynamics). Between those
// two, The Companion has a defined WARM persona (moderate pitch, conversational
// ref text) vs. the Demo's neutral utility read — so The Companion is the natural
// default for a cinematic launch film: warm, varied, and the least rushed of the
// persona voices.

import type { VoiceProfile, VoiceStyle } from "./tts";

export interface VoiceProfileInfo {
  id: VoiceProfile;
  name: string;
  /** Backend `instruct` persona string (from /profiles). */
  persona: string;
  /** One-line audition note. */
  note: string;
}

/** The four real, live OmniVoice profiles (source: GET /profiles). */
export const VOICE_PROFILES: Record<string, VoiceProfileInfo> = {
  fa99b1a5: {
    id: "fa99b1a5",
    name: "The Companion",
    persona: "female, middle-aged, moderate pitch, canadian accent",
    note: "Warm, conversational, widest prosodic range (LRA 20 LU). Chosen default for launch film.",
  },
  demo0001: {
    id: "demo0001",
    name: "OmniVoice Demo Voice",
    persona: "neutral reference",
    note: "Neutral, expressive (LRA 20 LU) but utility-toned; no warm persona.",
  },
  e67ce61e: {
    id: "e67ce61e",
    name: "The Upbeat",
    persona: "female, young adult, high pitch, american accent",
    note: "Energetic ad-read but FLAT loudness contour (LRA 0 LU) — reads mechanical.",
  },
  "7b059bea": {
    id: "7b059bea",
    name: "The Upbeat",
    persona: "female, young adult, high pitch, american accent",
    note: "As above; flat contour (LRA 0 LU). Avoid for narration.",
  },
};

/**
 * Chosen default profile for the launch film: "The Companion" (fa99b1a5).
 * Configurable per-scene (`vo.profile`) or globally (`OMNIVOICE_PROFILE` /
 * `synthVoForSpec({ profile })`).
 */
export const LAUNCH_VOICE_PROFILE: VoiceProfile = "fa99b1a5";

/**
 * The deliberate default read. `speed: 0.94` slows the delivery so clauses land
 * instead of rattling past — verified live as the primary fix for the
 * "mechanical/staccato" read (slows ~7% without pitch artifacts). A fixed `seed`
 * keeps the read's character stable across regenerations.
 *
 * NOTE: `instruct` is intentionally OMITTED. The backend's `instruct` is a
 * CLOSED persona vocabulary (accent/age/pitch/gender — e.g. "middle-aged",
 * "moderate pitch", "canadian accent"), NOT free-form tone direction: a phrase
 * like "warm, unhurried" 500s ("unsupported instruct items"). Warmth therefore
 * comes from the PROFILE choice (The Companion already bakes its warm persona
 * into its own profile `instruct`), not from this field. Callers that want to
 * re-cast a voice may set `instruct` to space/comma-joined VALID descriptors
 * only (see VOICE_INSTRUCT_VOCAB).
 */
export const LAUNCH_VOICE_STYLE: VoiceStyle = {
  speed: 0.94,
  seed: 42,
};

/**
 * The backend's closed `instruct` vocabulary (English), surfaced from a live
 * 500 validation probe. Only these tokens (comma/space-joined) are accepted;
 * anything else is rejected. Provided so callers can build a valid `instruct`
 * without hitting the backend to discover the allow-list.
 */
export const VOICE_INSTRUCT_VOCAB = [
  "american accent", "australian accent", "british accent", "canadian accent",
  "child", "chinese accent", "elderly", "female", "high pitch", "indian accent",
  "japanese accent", "korean accent", "low pitch", "male", "middle-aged",
  "moderate pitch", "portuguese accent", "russian accent", "teenager",
  "very high pitch", "very low pitch", "whisper", "young adult",
] as const;
