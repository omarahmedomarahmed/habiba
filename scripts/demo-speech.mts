/**
 * Synthesise the audio for the demo session.
 *
 *   npx tsx scripts/demo-speech.mts
 *
 * Chromium can be told to use a WAV file as its microphone
 * (`--use-file-for-fake-audio-capture`), which is the difference between a
 * demo that *shows* the transcription pipeline and one that actually runs it.
 * With the default fake device the browser emits a sine tone, the transcriber
 * dutifully returns nothing, and the note comes out empty — so the only way to
 * film the clinical half of this product honestly is to give it something real
 * to hear.
 *
 * Two voices, alternating, written as a plausible first session about work
 * stress and sleep. Deliberately not a crisis presentation: the crisis path
 * sends alerts and emails, and firing that at a database shared with
 * production to make a nicer video would be a bad trade.
 *
 * The output is cached — this costs money to run and the file does not change.
 * Delete it to re-synthesise.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.DEMO_OUT ?? "demo-output";
const FILE = join(OUT, "session-audio.wav");

/** Alternating turns. `voice` picks an OpenAI TTS voice per speaker. */
const SCRIPT: { voice: string; text: string }[] = [
  {
    voice: "shimmer",
    text: "Hi, come in. I'm glad you got here. Before we start — how are you doing today, right now, in this moment?",
  },
  {
    voice: "echo",
    text:
      "Honestly, not great. I've been running on about four hours of sleep for maybe three weeks now. " +
      "I get into bed and my head just will not switch off. I keep going over work.",
  },
  {
    voice: "shimmer",
    text: "Three weeks is a long time to carry that. When you say you go over work — is it a particular thing, or everything at once?",
  },
  {
    voice: "echo",
    text:
      "It's one project mostly. I took over someone else's work in March and I don't think I ever really caught up. " +
      "And now every email feels like someone is about to find out I'm behind.",
  },
  {
    voice: "shimmer",
    text: "That sounds exhausting. Has that feeling — that someone is about to find out — has that shown up for you before, in other jobs?",
  },
  {
    voice: "echo",
    text:
      "Yes. Same thing at my last place, actually. I ended up leaving. I told myself it was the commute but it wasn't really. " +
      "I just could not be in the building any more.",
  },
  {
    voice: "shimmer",
    text: "Thank you for telling me that. It helps to know it's a pattern rather than one bad job. How is it affecting things outside work?",
  },
  {
    voice: "echo",
    text:
      "I've stopped seeing people. My sister asked me to dinner twice this month and I cancelled both times. " +
      "I'm not sad exactly, I'm just — flat. And then I feel guilty about being flat.",
  },
  {
    voice: "shimmer",
    text: "Flat is a very precise word for it. Are you eating and drinking normally? Any alcohol to get to sleep?",
  },
  {
    voice: "echo",
    text: "Eating fine. A glass of wine most nights, maybe two. It does help me drop off, but I'm awake again at three anyway.",
  },
  {
    voice: "shimmer",
    text:
      "Right. So we've got broken sleep, a self-critical loop about work, some withdrawal from people, and alcohol doing a job it can't really do. " +
      "That's a very common shape and it is treatable. I'd like to try one small thing this week — a fixed wake time, even on the weekend. Could you do that?",
  },
  {
    voice: "echo",
    text: "I can try. Seven o'clock? That's about when I'd get up for work anyway.",
  },
  {
    voice: "shimmer",
    text:
      "Seven, every day. And I'd like you to text your sister back and put one dinner in the diary — you don't have to enjoy it, you just have to go. " +
      "We'll pick this up next week and look at the work loop properly.",
  },
  { voice: "echo", text: "Okay. That feels manageable. Thank you." },
];

const SILENCE_MS = 380;

type Wav = { rate: number; channels: number; bits: number; data: Buffer };

/** Parse a RIFF/WAVE buffer by walking chunks — the header is not always 44 bytes. */
function parseWav(buf: Buffer): Wav {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }
  let offset = 12;
  let fmt: { rate: number; channels: number; bits: number } | null = null;
  let data: Buffer | null = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, offset + 8 + size);
    if (id === "fmt ") {
      fmt = { channels: body.readUInt16LE(2), rate: body.readUInt32LE(4), bits: body.readUInt16LE(14) };
    } else if (id === "data") {
      data = body;
    }
    // Chunks are word-aligned; an odd size carries a pad byte.
    offset += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("missing fmt or data chunk");
  return { ...fmt, data };
}

function buildWav(parts: Wav[]): Buffer {
  const { rate, channels, bits } = parts[0];
  for (const p of parts) {
    if (p.rate !== rate || p.channels !== channels || p.bits !== bits) {
      throw new Error("segments differ in format; cannot concatenate");
    }
  }
  const gap = Buffer.alloc(
    Math.round((rate * SILENCE_MS) / 1000) * channels * (bits / 8),
  );
  const body = Buffer.concat(parts.flatMap((p, i) => (i === 0 ? [p.data] : [gap, p.data])));

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + body.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE((rate * channels * bits) / 8, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(body.length, 40);
  return Buffer.concat([header, body]);
}

async function speak(key: string, voice: string, text: string): Promise<Wav> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      response_format: "wav",
      speed: 1.0,
    }),
  });
  if (!response.ok) {
    throw new Error(`TTS ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  return parseWav(Buffer.from(await response.arrayBuffer()));
}

async function main() {
  if (existsSync(FILE) && !process.env.DEMO_SPEECH_FORCE) {
    console.log(`${FILE} already exists — delete it or set DEMO_SPEECH_FORCE=1 to re-synthesise.`);
    return;
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.startsWith("sk-smoke")) {
    console.error("OPENAI_API_KEY is missing or a placeholder.");
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  const parts: Wav[] = [];
  for (const [i, turn] of SCRIPT.entries()) {
    process.stdout.write(`  ${i + 1}/${SCRIPT.length} ${turn.voice}… `);
    const wav = await speak(key, turn.voice, turn.text);
    parts.push(wav);
    const seconds = wav.data.length / ((wav.rate * wav.channels * wav.bits) / 8);
    console.log(`${seconds.toFixed(1)}s`);
  }

  const out = buildWav(parts);
  writeFileSync(FILE, out);
  const { rate, channels, bits } = parts[0];
  const seconds = (out.length - 44) / ((rate * channels * bits) / 8);
  console.log(`\n✓ ${FILE} — ${seconds.toFixed(1)}s, ${rate} Hz, ${channels}ch, ${bits}-bit`);
}

void main();
