import { generateVideo } from "./src/pipeline/index.ts";
const r = await generateVideo(
  { url: "https://resubird.com/" },
  {
    outPath: "/Users/user4/Desktop/remotions-video/out/resubird-v7.mp4",
    music: true,
    musicBed: "audio/ncs-sky-high.mp3",
    workers: 1,
  },
);
console.log("RENDER_DONE", r.outPath, "| scenes:", r.spec.scenes.length, "| stills:", r.stills.length);
