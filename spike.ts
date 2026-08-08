import { renderVideo } from "./src/render/orchestrator";
import { SAMPLE_SPEC } from "./src/spec";

const spec = {
  ...SAMPLE_SPEC,
  scenes: SAMPLE_SPEC.scenes.filter(
    (s) => s.component === "ProductShot" || s.component === "Stats",
  ),
} as typeof SAMPLE_SPEC;

(async () => {
  const out = "/Users/user4/Desktop/remotions-video/spike.mp4";
  const r = await renderVideo(spec, { outPath: out, draft: true, workers: 1, log: (m)=>console.log(m) });
  console.log("RESULT", JSON.stringify(r));
})().catch((e) => { console.error("SPIKE FAIL", e); process.exit(1); });
