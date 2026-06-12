import React from "react";
import {
  Img,
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONTS } from "../theme";
import { RB, RB_GRADIENT_TEXT } from "./theme";
import { LightBackdrop, RCard, RKicker, RPop, ScoreRing } from "./ui";

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
    }}
  >
    {children}
  </AbsoluteFill>
);

const headline: React.CSSProperties = {
  fontFamily: FONTS.display,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: RB.ink,
};

const StaggerLine: React.FC<{
  words: string[];
  delay: number;
  perWord?: number;
  style?: React.CSSProperties;
}> = ({ words, delay, perWord = 4, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: "0.28em", justifyContent: "center" }}>
      {words.map((w, i) => {
        const s = spring({
          frame: frame - delay - i * perWord,
          fps,
          config: { damping: 13, mass: 0.5 },
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: interpolate(s, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              filter: `blur(${(1 - Math.min(s * 1.5, 1)) * 10}px)`,
              transform: `translateY(${(1 - s) * 60}px)`,
              ...style,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// ————— Scene 1: Hook —————
export const RHook: React.FC = () => (
  <AbsoluteFill>
    <LightBackdrop />
    <Center>
      <div style={{ ...headline, fontSize: 110, lineHeight: 1.14 }}>
        <StaggerLine words={["Recruiters", "give", "your", "resume"]} delay={2} />
        <StaggerLine
          words={["7", "seconds."]}
          delay={20}
          style={{ color: RB.orange }}
        />
        <StaggerLine words={["Then", "they", "move", "on."]} delay={48} />
      </div>
    </Center>
  </AbsoluteFill>
);

// ————— Scene 2: Problem punch —————
export const RProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stamps = [
    { text: "Rejected by ATS bots", delay: 0 },
    { text: "Zero callbacks", delay: 22 },
    { text: "No idea why", delay: 44 },
  ];
  const punch = spring({
    frame: frame - 70,
    fps,
    config: { damping: 12, mass: 0.5 },
  });
  return (
    <AbsoluteFill>
      <LightBackdrop />
      <Center>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 30,
            alignItems: "center",
          }}
        >
          {stamps.map((st, i) => {
            const s = spring({
              frame: frame - st.delay,
              fps,
              config: { damping: 11, mass: 0.4 },
            });
            return (
              <div
                key={i}
                style={{
                  ...headline,
                  fontSize: 74,
                  opacity:
                    interpolate(s, [0, 0.4], [0, 1], {
                      extrapolateRight: "clamp",
                    }) * (frame > 68 ? 0.3 : 1),
                  transform: `scale(${1.6 - s * 0.6})`,
                  textDecoration: frame > 68 ? "line-through" : "none",
                  textDecorationColor: RB.red,
                  textDecorationThickness: 6,
                }}
              >
                {st.text}
              </div>
            );
          })}
          <div
            style={{
              ...headline,
              marginTop: 20,
              fontSize: 94,
              opacity: interpolate(punch, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `scale(${0.8 + punch * 0.2})`,
              ...RB_GRADIENT_TEXT,
            }}
          >
            ResuBird shows you why.
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ————— Scene 3: Logo reveal —————
export const RLogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, mass: 0.9 } });
  const hop = Math.abs(Math.sin(frame / 14)) * (frame > 20 ? 10 : 0);
  return (
    <AbsoluteFill>
      <LightBackdrop />
      <Center>
        <div
          style={{
            width: 210,
            height: 210,
            transform: `scale(${s}) translateY(${-hop}px)`,
            filter: `drop-shadow(0 18px 36px ${RB.orange}55)`,
          }}
        >
          <Img
            src={staticFile("resubird/favicon.png")}
            style={{ width: "100%" }}
          />
        </div>
        <RPop delay={12}>
          <div style={{ ...headline, fontSize: 134, marginTop: 24 }}>
            <span style={RB_GRADIENT_TEXT}>ResuBird</span>
          </div>
        </RPop>
        <RPop delay={24}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 32,
              fontWeight: 500,
              color: RB.dim,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginTop: 14,
            }}
          >
            Free AI Resume Analyzer
          </div>
        </RPop>
      </Center>
    </AbsoluteFill>
  );
};

// ————— Scene 4: Analyzer —————
const Insight: React.FC<{
  delay: number;
  icon: string;
  text: string;
  color: string;
}> = ({ delay, icon, text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 13, mass: 0.5 },
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "18px 24px",
        borderRadius: 16,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateX(${(1 - s) * 60}px)`,
      }}
    >
      <span style={{ fontSize: 26 }}>{icon}</span>
      <span
        style={{
          fontFamily: FONTS.body,
          fontSize: 27,
          fontWeight: 600,
          color: RB.ink,
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const RAnalyzer: React.FC = () => (
  <AbsoluteFill>
    <LightBackdrop />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
      <RKicker>Resume Analyzer</RKicker>
      <RPop delay={8}>
        <div style={{ ...headline, fontSize: 78, marginTop: 26 }}>
          See why they <span style={RB_GRADIENT_TEXT}>skip you</span>
        </div>
      </RPop>
    </AbsoluteFill>
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 90,
        paddingTop: 160,
      }}
    >
      <RCard delay={16} style={{ padding: 60 }}>
        <ScoreRing score={92} delay={24} size={340} />
      </RCard>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Insight
          delay={40}
          icon="⚠️"
          text="Impact bullets missing numbers"
          color={RB.amber}
        />
        <Insight
          delay={50}
          icon="🔑"
          text="Add keywords: React, AWS"
          color={RB.blue}
        />
        <Insight
          delay={60}
          icon="✅"
          text="Formatting passes every major ATS"
          color={RB.green}
        />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

// ————— Scene 5: Builder —————
export const RBuilder: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const templates = [
    { src: "resubird/professionalTemplate.jpg", rot: -8, delay: 14 },
    { src: "resubird/mordernTemplate.jpg", rot: 0, delay: 20 },
    { src: "resubird/creativeTemplate.jpg", rot: 8, delay: 26 },
  ];
  const modes = [
    { icon: "📄", text: "Upload your PDF", delay: 44 },
    { icon: "📸", text: "Snap a photo", delay: 52 },
    { icon: "✍️", text: "Build with AI", delay: 60 },
  ];
  return (
    <AbsoluteFill>
      <LightBackdrop />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
        <RKicker>Resume Builder</RKicker>
        <RPop delay={8}>
          <div style={{ ...headline, fontSize: 78, marginTop: 26 }}>
            Start from <span style={RB_GRADIENT_TEXT}>anywhere</span>
          </div>
        </RPop>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 40,
          paddingBottom: 150,
        }}
      >
        {templates.map((t, i) => {
          const s = spring({
            frame: frame - t.delay,
            fps,
            config: { damping: 13, mass: 0.7 },
          });
          return (
            <div
              key={i}
              style={{
                width: 330,
                borderRadius: 16,
                overflow: "hidden",
                border: `1px solid ${RB.ink}14`,
                boxShadow: `0 30px 60px ${RB.ink}22`,
                opacity: interpolate(s, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `rotate(${t.rot * s}deg) translateY(${(1 - s) * 120 + (i === 1 ? -30 : 0)}px)`,
              }}
            >
              <Img src={staticFile(t.src)} style={{ width: "100%" }} />
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 44,
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          {modes.map((m, i) => (
            <RCard
              key={i}
              delay={m.delay}
              style={{
                padding: "16px 30px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderRadius: 999,
              }}
            >
              <span style={{ fontSize: 26 }}>{m.icon}</span>
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 27,
                  fontWeight: 700,
                  color: RB.ink,
                }}
              >
                {m.text}
              </span>
            </RCard>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ————— Scene 6: Job matches —————
const JOB_CARDS = [
  {
    co: "Google",
    role: "Product Manager",
    loc: "Bengaluru · 18–28 LPA",
    color: "#4285F4",
    delay: 20,
  },
  {
    co: "Amazon",
    role: "Software Engineer",
    loc: "Hyderabad · 12–20 LPA",
    color: "#FF9900",
    delay: 30,
  },
  {
    co: "Microsoft",
    role: "Data Analyst",
    loc: "Noida · 10–16 LPA",
    color: "#7FBA00",
    delay: 40,
  },
];

export const RJobs: React.FC = () => (
  <AbsoluteFill>
    <LightBackdrop />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
      <RKicker>Job Matches</RKicker>
      <RPop delay={8}>
        <div style={{ ...headline, fontSize: 78, marginTop: 26 }}>
          Jobs worth <span style={RB_GRADIENT_TEXT}>your time</span>
        </div>
      </RPop>
      <RPop delay={18}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 33,
            color: RB.dim,
            marginTop: 18,
          }}
        >
          Matched to your skills, not just your job title.
        </div>
      </RPop>
    </AbsoluteFill>
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 90,
      }}
    >
      <div style={{ display: "flex", gap: 36 }}>
        {JOB_CARDS.map((j, i) => (
          <RCard key={i} delay={j.delay} float style={{ padding: 36, width: 430 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 16,
                  background: `${j.color}1c`,
                  border: `1px solid ${j.color}44`,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: FONTS.display,
                  fontSize: 30,
                  fontWeight: 700,
                  color: j.color,
                }}
              >
                {j.co[0]}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 30,
                    fontWeight: 700,
                    color: RB.ink,
                  }}
                >
                  {j.role}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 23,
                    color: RB.dim,
                    marginTop: 3,
                  }}
                >
                  {j.co} · {j.loc}
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 24,
                display: "inline-flex",
                padding: "8px 18px",
                borderRadius: 999,
                background: `${RB.green}16`,
                border: `1px solid ${RB.green}38`,
                fontFamily: FONTS.mono,
                fontSize: 20,
                fontWeight: 600,
                color: RB.green,
              }}
            >
              STRONG MATCH
            </div>
          </RCard>
        ))}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

// ————— Scene 7: Suite overview —————
const SUITE = [
  { icon: "🔍", name: "Resume Analyzer", note: "92/100 fit scores", delay: 14 },
  { icon: "🛠️", name: "Resume Builder", note: "3 starting modes", delay: 24 },
  { icon: "🤖", name: "ATS Checker", note: "Pass the bots", delay: 34 },
  { icon: "✉️", name: "Cover Letters", note: "Matched to the post", delay: 44 },
];

export const RSuite: React.FC = () => (
  <AbsoluteFill>
    <LightBackdrop />
    <Center>
      <RPop>
        <div style={{ ...headline, fontSize: 80, marginBottom: 70 }}>
          One <span style={RB_GRADIENT_TEXT}>free toolkit</span>
        </div>
      </RPop>
      <div style={{ display: "flex", gap: 36 }}>
        {SUITE.map((t, i) => (
          <RCard
            key={i}
            delay={t.delay}
            style={{ padding: "46px 38px", width: 360, textAlign: "center" }}
          >
            <div style={{ fontSize: 56 }}>{t.icon}</div>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 33,
                fontWeight: 700,
                color: RB.ink,
                marginTop: 18,
              }}
            >
              {t.name}
            </div>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 24,
                color: RB.dim,
                marginTop: 8,
              }}
            >
              {t.note}
            </div>
          </RCard>
        ))}
      </div>
    </Center>
  </AbsoluteFill>
);

// ————— Scene 8: CTA —————
export const RCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, mass: 0.9 } });
  const pulse = 1 + Math.sin(frame / 9) * 0.02;
  const urlSpring = spring({
    frame: frame - 34,
    fps,
    config: { damping: 13, mass: 0.6 },
  });
  const sweepX = interpolate(frame % 75, [18, 55], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <LightBackdrop />
      <Center>
        <div
          style={{
            width: 140,
            height: 140,
            transform: `scale(${s})`,
            filter: `drop-shadow(0 16px 32px ${RB.orange}55)`,
            marginBottom: 30,
          }}
        >
          <Img
            src={staticFile("resubird/favicon.png")}
            style={{ width: "100%" }}
          />
        </div>
        <RPop delay={8}>
          <div
            style={{
              ...headline,
              fontSize: 116,
              textAlign: "center",
              lineHeight: 1.06,
            }}
          >
            Get past <span style={RB_GRADIENT_TEXT}>the bots.</span>
          </div>
        </RPop>
        <RPop delay={18}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 30,
              color: RB.dim,
              marginTop: 26,
              fontWeight: 500,
              letterSpacing: "0.08em",
            }}
          >
            Analyzer · Builder · ATS Checker · Cover Letters
          </div>
        </RPop>
        <div
          style={{
            marginTop: 56,
            opacity: interpolate(urlSpring, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${(1 - urlSpring) * 40}px) scale(${pulse})`,
            padding: "26px 70px",
            borderRadius: 999,
            fontFamily: FONTS.display,
            fontSize: 46,
            fontWeight: 700,
            color: "#fff",
            background: `linear-gradient(100deg, ${RB.orange}, #ea580c)`,
            boxShadow: `0 22px 50px ${RB.orange}66, 0 8px 20px ${RB.ink}22`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <span style={{ position: "relative", zIndex: 1 }}>
            Analyze free → resubird.com
          </span>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent ${sweepX - 14}%, rgba(255,255,255,0.35) ${sweepX}%, transparent ${sweepX + 14}%)`,
            }}
          />
        </div>
      </Center>
    </AbsoluteFill>
  );
};
