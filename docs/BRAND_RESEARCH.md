# Yupcha & ResuBird — Brand & Asset Reference

> Scraped 2026‑06‑13 from yupcha.com and resubird.com (HTML + Vite/i18n JS bundles
> + on‑page videos). Use this as the **source of truth** for video copy so we never
> invent product details or stats. "Confirmed" = seen verbatim in site copy or a
> product video frame. "Inferred" = reasoned from context.

---

## 1. Yupcha — the Agentic Recruitment Platform

### Positioning & taglines (confirmed)
- **"The Agentic Hiring Platform."**
- "Run end‑to‑end hiring workflows with AI agents — conduct interviews, automate
  candidate screening, and accelerate recruitment."
- "End‑to‑end AI recruiting platform." · "Autonomous interviewing platform." ·
  "Autonomous Interviews for any field." · "Field‑Agnostic AI."
- Worldview copy they actually publish: **"The Future of AI Hiring is Agentic."**

### The Yupcha Agent — the agentic core (confirmed, from hero.mp4 @ ~32s)
Yupcha is not just an AI interviewer; the product centers on a **conversational agent
dashboard** ("Yupcha Agent"):
- Prompt: **"How can I help you today? I can schedule interviews, manage templates,
  and help you navigate the Yupcha platform."**
- Action cards: **"See what I can do — Watch a quick 45‑second interactive demo,"**
  "Schedule an interview," "Upcoming interviews," "Browse templates," "Create a template."
- Chat input: **"Message Yupcha AI…"**
- Left nav: Yupcha Agent · Dashboard · Candidates · Schedule · Interviews ·
  Job Templates · API.
- There is an **"AI recruiter named 'Alex'"** referenced in copy.

> Takeaway: the differentiator is **agency** — it *does* the recruiting workflow
> (schedules, screens, ranks), not just answers questions. The hero film is already
> dark/cinematic ("INTRODUCING …") — our manifesto/INTERVAL direction matches house style.

### Feature set (confirmed strings)
**Interviewing**
- Conversational, two‑way **voice AI** ("Deep voice‑to‑voice AI," "Conversational
  voice AI for global pools," "High‑depth voice AI interviews").
- "Adaptive interviews," "AI takes over the conversation in real‑time."
- "Create interviews for candidates in single or **bulk**."
- Real **technical depth** (their wedge vs. soft‑skills‑only rivals): "Modern hiring
  requires autonomous AI that tests real technical depth — not just soft skills."

**Anti‑cheating suite (a major, under‑used differentiator)**
- **"ChatGPT & LLM Detection"** — "Flags if you open ChatGPT, Claude, Gemini, or any
  AI chat tool during the session."
- **"Extra Monitor Detection"** — "Detects if a second screen is connected to your
  device during the interview."
- **"Face Recognition + Tab Lock"** — "Every time you leave the interview tab, it's
  logged — time, duration, and how often."
- "Catches AI assistant apps running in the background built to bypass interviews."
- Marketed as **"Complete Anti‑Cheating" / "Full proctoring suite — all included."**

**Scoring & fairness**
- "Fair Candidate Scoring," "Better Candidate Evaluation," "Detailed scoring reports,"
  "Get comprehensive results and scores instantly."
- Bias reduction is an explicit FAQ: "Does Yupcha help reduce hiring bias?"

**Recruiter tooling / business**
- Job templates, candidate management, scheduling, **API / IaaS** ("AI Interview and
  IaaS solutions"), bulk interview creation, enterprise/bulk pricing, free credits.
- Heavy comparison‑SEO play: dedicated "Yupcha vs X" pages for **Fairgo, Interviewer.AI,
  Talently, Sapia.ai, Apriora, Babblebots, Hyring, InCruiter, Micro1, Mindely, Evalgator,
  alex.ai** (positioned as deeper/technical + full proctoring vs. their "basic monitoring").

### Stats (confirmed from earlier page reads — re‑verify before publishing externally)
- 530+ candidates screened · 98.4% ATS match (example) · 4.9★ avg review ·
  6,000+ community members · 98% confidence (demo). Metric multipliers seen in JS: 2×, 4×, 6×, 2+.

### Tone
Confident, technical, forward ("agentic," "autonomous," "end‑to‑end"). Cinematic in the
hero. Slightly combative in comparisons (deeper/fairer than rivals).

### Brand aesthetic
- **Dark navy void** (#040816‑ish), centered spaced‑caps display, soft radial glow,
  subtle grain — the hero is essentially an Apple‑style title film.
- Logo: 4‑color pinwheel "X" (blue #4286f5, green #0f9d58, yellow #f4b400, red #db4437)
  + "Yupcha" wordmark. (Already in `public/yupcha/logo.svg`.)

---

## 2. ResuBird — Free AI Resume Analyzer (candidate side)

### Positioning & taglines (confirmed)
- **"Your Resume Gets Analyzed in Seconds."** · "ResuBird – Free AI Resume Analyzer."
- "See exactly why recruiters skip your resume, fix it before they do."
- **"Free · No account required · Results in ~30s."** · "Get your full AI resume score
  in seconds for free." · "Build ATS‑friendly resumes that get you hired faster."

### Product suite (confirmed)
Analyze Resume · Resume Builder · Cover Letter Builder · ATS Checker · Batch Analysis ·
Job Recommendations / Job Feed · Community Forum · (+ utility tools: PNG→PDF,
Background Remover). "Mock Interview — practice with our AI interviewer" is **Coming Soon**
(the bridge into Yupcha).

### The real product pipeline & UI copy (confirmed from product videos)
- **Optimization pipeline:** `Upload → Parse → ATS → Build` (literal stepper).
- Modal: **"Optimizing Resume — Optimizing for ATS… 40% · ~18 seconds left."**
- Loading states (verbatim — reuse these for grounded UI): **"Parsing your resume…",
  "Extracting skills & experience…", "Computing ATS compatibility…", "Analyzing Resume…"**
- **"DID YOU KNOW: Recruiters spend an average of 6‑7 seconds scanning a resume.
  We'll show you exactly what they'd notice first."**
  → confirms our `Ghosted` short's "7 seconds" hook is on‑brand.
- Analyzer screen: "Let's Review Your Resume," "Paste the job description or pick from
  your library," "Start Analysis," My jobs / Premade tabs, example role **"Python
  Developer — Google Inc."**
- Cover‑letter screen: job desc ("Python Developer to build backend services for Google
  Cloud, 3+ yrs Python"), **TONE selector: Professional / Enthusiastic / Formal /
  Creative**, templates: Professional / Creative / Modern.
- ATS upload accepts **PDF / DOCX**; "Full ATS compatibility report," "Instant ATS score
  and optimization suggestions," "Deep AI‑powered scanning for recruiter compliance."

### Stats (confirmed)
- 98.4% ATS match (example) · 92% Optimization Score (example) · 78% cover‑letter match
  uplift · 98% Lighthouse perf (their own eng note) · "thousands" of forum members.

### Tone
Warm, plain‑spoken, candidate‑empathetic, urgency‑light ("free," "~30s," "no account").
Blunt about the problem ("why recruiters skip your resume").

### Brand aesthetic
- **Warm cream/orange light** theme. Orange #F97316 primary, amber #DE9D5A, cream #FDF4E7,
  ink #1C1917. Logo: orange bird + résumé card (`public/resubird/favicon.png`).
- Social proof bar: Google, Amazon, Microsoft, Meta, Stripe logos.

---

## 3. The two together (the funnel)
ResuBird (candidate, warm) → "Mock Interview … coming soon" → **Yupcha** (recruiter +
the real interview, dark). ResuBird makes your résumé legible to the bots; Yupcha is the
live test the résumé only earns you. This is exactly the `ProveYoureReal` short and the
strategy thread — and it's now confirmed by ResuBird advertising an AI‑interviewer
"mock" feature.

---

## 4. Implications for the INTERVAL script (and future films)
| Script beat | Now grounded in real product |
|---|---|
| "It never hears your name, only how you think" (bias dissolve) | Confirmed: "Fair Candidate Scoring," bias‑reduction FAQ |
| "No AI to hide behind" | **Strongly** confirmed: ChatGPT/Claude/Gemini detection, second‑monitor detection, tab‑lock, background‑app catching. This is a real, ownable beat — lean into it. |
| "While you sleep … listening to all of them at once" | Confirmed: bulk interviews, autonomous, 24/7 agentic; "Yupcha Agent schedules interviews." |
| Parallel/voice across the globe | Confirmed: "conversational voice AI for global pools," "deep voice‑to‑voice AI." |
| "You wake up to the answer" (ranked by morning) | Matches `YupchaScreensAll`; agent ranks candidates. |
| Product reveal | Use the real **Yupcha Agent** dashboard + pinwheel bloom; house style is already dark‑cinematic. |

**New angles unlocked**
- **The Yupcha Agent** (conversational, does the workflow) — a richer hero than "AI
  interviewer." A film could open on the agent *acting* autonomously overnight.
- **Anti‑cheat as a thriller beat** — "it knows when you're not alone / when the machine
  is helping you." Pairs with the Nolan tension register.
- **Voice‑to‑voice** — a genuine "it talks, it listens" sequence (and ties to OmniVoice).
- ResuBird now has **real product video** (below) usable as live footage via Remotion
  `OffthreadVideo` instead of coded mockups.

**Honesty guardrails**
- Treat all numeric stats as *examples* unless re‑verified; don't state disputed industry
  stats (e.g., "75% of resumes rejected by ATS") as fact. The "6‑7 seconds" line is safe —
  it's ResuBird's own copy.

---

## 5. Asset manifest (downloaded to repo)
| File | What it is | Dim / len |
|---|---|---|
| `public/yupcha/hero.mp4` | Official dark cinematic hero film ("INTRODUCING" → Yupcha Agent dashboard) | 1280×720 · 46s |
| `public/yupcha/hero-poster.jpg` | Hero poster frame | — |
| `public/yupcha/nature_bg.webp` | Background texture used on site | — |
| `public/yupcha/logo.svg` | Pinwheel logo | — |
| `public/yupcha/interviewer.webp`, `dashboard.webp`, `resubird.webp`, `phone.webp`, `candidate2.jpeg`, `candidate_happy.webp` | Product screenshots (earlier pull) | — |
| `public/resubird/analyze_screen_final.mp4` | **Real** Analyzer UI screen‑recording | 1920×1080 · 14.8s |
| `public/resubird/ats_screen_final.mp4` | **Real** ATS optimize pipeline (Upload→Parse→ATS→Build, "6‑7 seconds") | 1920×1080 · 13.7s |
| `public/resubird/builder_screen_final.mp4` | **Real** Resume Builder UI | 1920×1080 · 10.4s |
| `public/resubird/cover_letter_final_screen.mp4` | **Real** Cover Letter builder (tone selector, templates) | 1920×1080 · 18.7s |
| `public/resubird/og-image.png`, `favicon.png`, template jpgs | Brand + templates (earlier pull) | — |

## 6. Verbatim copy bank (safe to reuse — no hallucination)
**Yupcha:** "The Agentic Hiring Platform" · "Run end‑to‑end hiring workflows with AI
agents" · "How can I help you today?" · "Message Yupcha AI…" · "Schedule an interview" ·
"ChatGPT & LLM Detection" · "Flags if you open ChatGPT, Claude, Gemini, or any AI chat
tool during the session" · "Detects if a second screen is connected" · "Fair Candidate
Scoring" · "The Future of AI Hiring is Agentic."

**ResuBird:** "Your Resume Gets Analyzed in Seconds" · "Free · No account required ·
Results in ~30s" · "Parsing your resume…" · "Extracting skills & experience…" ·
"Computing ATS compatibility…" · "Optimizing for ATS…" · "Recruiters spend an average of
6‑7 seconds scanning a resume" · "See exactly why recruiters skip your resume, fix it
before they do" · TONE: Professional / Enthusiastic / Formal / Creative.

**Color tokens:** Yupcha — blue `#4286f5`, green `#0f9d58`, yellow `#f4b400`, red
`#db4437`, void `#040816`. ResuBird — orange `#F97316`, amber `#DE9D5A`, cream `#FDF4E7`,
ink `#1C1917`. (Mirrored in `src/promo/theme.ts` and `src/promo/resubird/theme.ts`.)
