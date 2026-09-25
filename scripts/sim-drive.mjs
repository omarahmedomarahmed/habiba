/**
 * The simulation's browser helper, shared by every agent in a round.
 * `docs/simulation/05-THE-BOARD.md` and `06-THE-AUDIO.md` are the protocol.
 *
 *   import { open, shot, board, inbox, BASE } from "../../../../home/user/habiba/scripts/sim-drive.mjs";
 *   const { page, close } = await open("T1");                 // a desktop browser, signed-in state kept per person
 *   const { page } = await open("P1", { mobile: true });       // a phone-sized one
 *   const { page } = await open("T1", { audio: "first-en-t" }); // a microphone playing .sim-audio/first-en-t.wav
 *   await shot(page, "R1", "T1", "TH1.2");
 *   board("R1", "T1", "TH1.2", "/signup", "created the account", "Save details");
 *   const text = inbox("amira.demo@example.com");              // kept messages to that address, newest first
 *
 * Each person's cookies live in `.sim-state/<key>.json` (git ignores it), saved on close, so a
 * person stays signed in between an agent's scripts. Screenshots go to
 * `docs/simulation-run/shots/<round>/`, which git ignores (07-THE-RECORD.md says why).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

export const BASE = process.env.SIM_BASE ?? "https://24therapy.app";
const ROOT = new URL("..", import.meta.url).pathname;
const STATE = join(ROOT, ".sim-state");
const SHOTS = join(ROOT, "docs/simulation-run/shots");
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export async function open(who, opts = {}) {
  mkdirSync(STATE, { recursive: true });
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  if (opts.audio) args.push(`--use-file-for-fake-audio-capture=${join(ROOT, ".sim-audio", `${opts.audio}.wav`)}`);
  const browser = await chromium.launch({ executablePath: CHROME, args });
  const statePath = join(STATE, `${who}.json`);
  const ctx = await browser.newContext({
    ...(opts.mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }),
    ...(existsSync(statePath) && !opts.fresh ? { storageState: statePath } : {}),
    permissions: ["camera", "microphone"],
    locale: opts.locale ?? "en-GB",
    timezoneId: "Africa/Cairo",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(opts.timeout ?? 30_000);
  const close = async () => {
    await ctx.storageState({ path: statePath }).catch(() => {});
    await browser.close();
  };
  return { browser, ctx, page, close };
}

export async function shot(page, round, who, step) {
  const dir = join(SHOTS, round);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${who}-${step}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

export function board(round, who, step, page, did, next = "", waitingOn = "") {
  return execFileSync("npm", ["run", "-s", "sim:board", "--", "post", round, who, step, page, did, next, waitingOn], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

export function waitFor(step, seconds = 300) {
  try {
    execFileSync("npm", ["run", "-s", "sim:board", "--", "wait", step, String(seconds)], { cwd: ROOT, encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

export function inbox(address) {
  return execFileSync("npm", ["run", "-s", "on:production", "--", "sim:inbox", "--", address], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
  });
}

/**
 * The patient's side of an online session, sent the way the clinician's room sends it.
 *
 * In a real video call the clinician's browser records the patient's incoming track and posts it
 * to `/api/sessions/<id>/transcribe` with `speaker=patient`. This run's network carries no
 * WebSocket, so the call never connects; this makes the same request with the clinician's own
 * cookie, from the clinician's signed-in context, in 8 second chunks at the pace of speech.
 * `docs/simulation/06-THE-AUDIO.md` says when it is used. The session must be live and the
 * patient must have said yes to recording, exactly as for the room.
 */
export async function postPatientTrack(ctx, sessionId, audio, opts = {}) {
  const { readFileSync } = await import("node:fs");
  const { randomUUID } = await import("node:crypto");
  const buf = readFileSync(join(ROOT, ".sim-audio", `${audio}.wav`));
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") fmt = { rate: buf.readUInt32LE(off + 12) };
    if (id === "data") data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  /* 16 kHz mono 16-bit, as the room's recorder sends: resample linearly from the file's rate. */
  const inSamples = data.length / 2;
  const outSamples = Math.floor((inSamples * 16000) / fmt.rate);
  const pcm = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const pos = (i * fmt.rate) / 16000;
    const a = Math.floor(pos);
    const b = Math.min(a + 1, inSamples - 1);
    const t = pos - a;
    pcm.writeInt16LE(Math.round(data.readInt16LE(a * 2) * (1 - t) + data.readInt16LE(b * 2) * t), i * 2);
  }
  const wav = (slice) => {
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + slice.length, 4); h.write("WAVE", 8);
    h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write("data", 36); h.writeUInt32LE(slice.length, 40);
    return Buffer.concat([h, slice]);
  };
  const per = 16000 * 2 * 8;
  const results = [];
  for (let n = 0, seq = 1; n < pcm.length; n += per, seq++) {
    const slice = pcm.subarray(n, Math.min(n + per, pcm.length));
    const res = await ctx.request.post(`${BASE}/api/sessions/${sessionId}/transcribe`, {
      headers: { Origin: BASE },
      multipart: {
        audio: { name: `chunk-${seq}.wav`, mimeType: "audio/wav", buffer: wav(slice) },
        sequence: String(seq),
        chunk: randomUUID(),
        duration: String(slice.length / 32000),
        speaker: "patient",
      },
    });
    results.push({ seq, status: res.status(), body: (await res.text()).slice(0, 200) });
    if (opts.realtime !== false) await new Promise((r) => setTimeout(r, Math.min(8000, (slice.length / 32000) * 1000)));
  }
  return results;
}
