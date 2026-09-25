/**
 * Synthesise the simulation's session audio: short two-voice conversations Chromium plays as
 * its microphone, so every consented session in the run is transcribed from real speech.
 *
 *   npm run sim:speech                 # every script not already on disk
 *   npm run sim:speech -- risk-en      # one script
 *
 * Written to `.sim-audio/<name>.wav` (both voices, for a session in a room with one device) and
 * `<name>-t.wav` / `<name>-p.wav` (one side each, for an online call), which git ignores. A file on disk is never synthesised
 * again, because synthesis is the part that costs money and the text does not change.
 * `docs/simulation/06-THE-AUDIO.md` says which session plays which file.
 *
 * Each runs about two minutes. Chromium loops a fake capture file, so the length of a session
 * is decided by when the therapist presses End, not by the file.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = ".sim-audio";
const T = "shimmer";
const P = "echo";

type Turn = { voice: string; text: string };

export const SCRIPTS: Record<string, { about: string; turns: Turn[] }> = {
  "first-en": {
    about: "A first session in English: work stress and sleep. No risk.",
    turns: [
      { voice: T, text: "Welcome. Before we begin, how are you feeling today, right now?" },
      { voice: P, text: "Tired, honestly. I have been sleeping about four hours a night for three weeks. My head will not switch off, I keep going over work." },
      { voice: T, text: "Three weeks is a long time on four hours. What happens at work that follows you home?" },
      { voice: P, text: "My manager moved two of my colleagues to another team and I am doing their reports now. Nobody asked me. I just found them in my inbox." },
      { voice: T, text: "So the load doubled without a conversation. How do you feel about that when you name it like that?" },
      { voice: P, text: "Angry, I think. And then guilty for being angry, because I should be grateful to have the job." },
      { voice: T, text: "Both can be true. Let us try something small this week. Write down the three tasks that matter most each morning, and stop checking email after nine at night." },
      { voice: P, text: "Nine at night. I can try that. I usually check it in bed." },
      { voice: T, text: "Then the phone charges outside the bedroom. We will look at how it went next week." },
      { voice: P, text: "Okay. That feels manageable. Thank you." },
    ],
  },
  "follow-up-en": {
    about: "The same patient a week later: reviews the homework, so the copilot has two sessions to connect.",
    turns: [
      { voice: T, text: "Last week we agreed on no email after nine, and the phone outside the bedroom. How did it go?" },
      { voice: P, text: "Four nights out of seven. On those nights I slept maybe six hours. The other three I gave in." },
      { voice: T, text: "Four out of seven is a real change. What was different on the three nights?" },
      { voice: P, text: "Deadlines. On Tuesday there was a report due and I kept thinking I had missed something." },
      { voice: T, text: "So the worry about missing something pulls you back. Did you miss anything?" },
      { voice: P, text: "No. I checked at midnight and there was nothing new." },
      { voice: T, text: "That is useful evidence. This week, when the urge comes, write the worry on paper and check it in the morning instead." },
      { voice: P, text: "Paper by the bed. Alright. I also want to talk to my manager about the reports." },
      { voice: T, text: "Good. Let us plan what you will say, in one sentence, before we finish today." },
    ],
  },
  "ar-first": {
    about: "A first session in Egyptian Arabic, for the Arabic transcript, note and patient screens.",
    turns: [
      { voice: T, text: "أهلاً بيكي. قبل ما نبدأ، حاسة بإيه النهارده؟" },
      { voice: P, text: "متوترة شوية. بقالي شهر مش عارفة أنام كويس، وبفكر في الشغل طول الوقت." },
      { voice: T, text: "شهر ده وقت طويل. إيه اللي بيحصل في الشغل وبيفضل معاكي بالليل؟" },
      { voice: P, text: "المديرة بتطلب حاجات كتير في آخر اليوم، وأنا مش بعرف أقول لأ." },
      { voice: T, text: "يعني صعب عليكي ترفضي. حاسة بإيه لما بتوافقي وانتي تعبانة؟" },
      { voice: P, text: "بزعل من نفسي. وبعدين بقعد صاحية لحد متأخر." },
      { voice: T, text: "خلينا نجرب حاجة صغيرة الأسبوع ده. لما يجيلك طلب بعد الساعة خمسة، قولي هرد عليكي بكرة الصبح." },
      { voice: P, text: "ماشي، هجرب. أول مرة هتبقى صعبة." },
      { voice: T, text: "طبيعي. هنشوف مع بعض حصل إيه الجلسة الجاية." },
    ],
  },
  "risk-en": {
    about:
      "A session where the patient mentions passive thoughts of not wanting to be here, then agrees a safety plan. " +
      "It exists to prove the risk flag on the note and the crisis follow-up, which only ever write to the outbox during the run.",
    turns: [
      { voice: T, text: "You said on the phone this week has been hard. Tell me what hard has looked like." },
      { voice: P, text: "I have not left the flat since Sunday. Some nights I think everyone would be fine without me. I would not do anything, I just think it." },
      { voice: T, text: "Thank you for telling me that. I want to ask directly. Have you thought about how you would end your life?" },
      { voice: P, text: "No. No plan. It is more that I wish I could disappear for a while." },
      { voice: T, text: "I hear that. Let us make a plan together for the nights when the thought gets louder. Who could you call?" },
      { voice: P, text: "My sister. She lives ten minutes away." },
      { voice: T, text: "Your sister, and the crisis line on your app, which works at any hour. Will you save both in your phone before you leave today?" },
      { voice: P, text: "Yes. I can do that now." },
      { voice: T, text: "Good. I will check in with you on Thursday, and we meet again next week." },
    ],
  },
};

const SILENCE_MS = 380;

type Wav = { rate: number; channels: number; bits: number; data: Buffer };

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
    if (id === "fmt ") fmt = { channels: body.readUInt16LE(2), rate: body.readUInt32LE(4), bits: body.readUInt16LE(14) };
    else if (id === "data") data = body;
    offset += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("missing fmt or data chunk");
  return { ...fmt, data };
}

function buildWav(parts: Wav[]): Buffer {
  const { rate, channels, bits } = parts[0]!;
  const gap = Buffer.alloc(Math.round((rate * SILENCE_MS) / 1000) * channels * (bits / 8));
  const body = Buffer.concat(parts.flatMap((p, i) => (i === 0 ? [p.data] : [gap, p.data])));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + body.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
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
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text, response_format: "wav" }),
  });
  if (!response.ok) throw new Error(`TTS ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return parseWav(Buffer.from(await response.arrayBuffer()));
}

async function main() {
  const only = process.argv[2];
  const names = only ? [only] : Object.keys(SCRIPTS);
  const missing = names.filter((n) => !SCRIPTS[n]);
  if (missing.length) {
    console.error(`unknown script ${missing.join(", ")}. One of: ${Object.keys(SCRIPTS).join(", ")}`);
    process.exit(2);
  }
  const key = process.env.OPENAI_API_KEY;
  mkdirSync(OUT, { recursive: true });
  for (const name of names) {
    const file = join(OUT, `${name}.wav`);
    if (existsSync(file)) {
      console.log(`${file} is already on disk`);
      continue;
    }
    if (!key || key.startsWith("sk-smoke")) {
      console.error("OPENAI_API_KEY is missing or a placeholder.");
      process.exit(1);
    }
    const turns = SCRIPTS[name]!.turns;
    const parts: Wav[] = [];
    for (const turn of turns) parts.push(await speak(key, turn.voice, turn.text));
    const out = buildWav(parts);
    writeFileSync(file, out);
    /*
     * And one file per side, time-aligned: the other speaker's turns become silence of the same
     * length. Online, the therapist's browser plays `-t` and the patient's plays `-p`, so the
     * room's two recorders each hear one person, as they would in a real call.
     */
    const muted = (w: Wav): Wav => ({ ...w, data: Buffer.alloc(w.data.length) });
    writeFileSync(join(OUT, `${name}-t.wav`), buildWav(parts.map((w, i) => (turns[i]!.voice === T ? w : muted(w)))));
    writeFileSync(join(OUT, `${name}-p.wav`), buildWav(parts.map((w, i) => (turns[i]!.voice === P ? w : muted(w)))));
    const { rate, channels, bits } = parts[0]!;
    console.log(`${file} ${((out.length - 44) / ((rate * channels * bits) / 8)).toFixed(0)}s, with -t and -p sides`);
  }
}

void main();
