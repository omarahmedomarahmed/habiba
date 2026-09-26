import assert from "node:assert/strict";
import { after, test } from "node:test";

import { startMockOpenAi } from "./mock-openai";

/*
 * 🔴 Board 824 / 868: the language of a chunk, tested on the request that is
 * actually sent.
 *
 * Pinning Arabic for every session with an Arabic speaker translated an English
 * "Tired, honestly." into Arabic, and detection wrote Arabic speech in Latin
 * letters. A session that may be in Arabic or English now asks once per
 * language, each pinned, with the model's confidence, and keeps the surer
 * pass that is in its own script. `lib/env` reads the address once, so it is
 * set before the transcriber is imported.
 */
const mock = startMockOpenAi(4337);
after(() => mock.server.close());
process.env.OPENAI_BASE_URL = "http://127.0.0.1:4337/v1";
process.env.OPENAI_API_KEY ||= "sk-mock";
const transcriber = () => import("../lib/ai/transcribe");

const audio = () => new Uint8Array(4000).buffer as ArrayBuffer;

test("board 824 / 868 a session in Arabic or English asks once per language, each pinned", async () => {
  const { transcribeAudioDetailed } = await transcriber();
  const before = mock.state.transcriptionRequests.length;
  const result = await transcribeAudioDetailed({ audio: audio(), mimeType: "audio/wav", languages: ["ar", "en"] });
  const sent = mock.state.transcriptionRequests.slice(before);
  assert.equal(result.passes, 2);
  assert.deepEqual(sent.map((r) => r.fields.language?.[0]).sort(), ["ar", "en"]);
  for (const request of sent) {
    assert.deepEqual(request.fields["include[]"], ["logprobs"], "each pass asks for the model's confidence");
  }
  /* Each pass carries the hint in its own language. */
  const arabic = sent.find((r) => r.fields.language?.[0] === "ar")!;
  assert.match(arabic.fields.prompt?.[0] ?? "", /[؀-ۿ]/);
});

test("board 824 a language set in the room is one pinned request, and none known is one detected request", async () => {
  const { transcribeAudioDetailed } = await transcriber();
  let before = mock.state.transcriptionRequests.length;
  await transcribeAudioDetailed({ audio: audio(), mimeType: "audio/wav", language: "en", languages: ["ar", "en"] });
  let sent = mock.state.transcriptionRequests.slice(before);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]!.fields.language, ["en"]);
  assert.equal(sent[0]!.fields["include[]"], undefined);

  before = mock.state.transcriptionRequests.length;
  await transcribeAudioDetailed({ audio: audio(), mimeType: "audio/wav", languages: [] });
  sent = mock.state.transcriptionRequests.slice(before);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.fields.language, undefined, "no language key: the API detects one");
});

test("board 824 / 868 the surer pass in its own script is the transcript", async () => {
  const { pickTranscription } = await transcriber();
  /* 824: English speech; the Arabic pass translated it, less surely. */
  assert.equal(
    pickTranscription([
      { language: "ar", text: "تعب، بصراحة.", confidence: -0.9 },
      { language: "en", text: "Tired, honestly.", confidence: -0.1 },
    ])?.text,
    "Tired, honestly.",
  );
  /* 868: Arabic speech; the English pass wrote it in Latin letters, and is never kept over Arabic. */
  assert.equal(
    pickTranscription([
      { language: "ar", text: "يعني صعب عليكي ترفضي", confidence: -0.6 },
      { language: "en", text: "Jien, sa baħalek tirfudi.", confidence: -0.5 },
    ])?.text,
    "Jien, sa baħalek tirfudi.",
    "a Latin line from the English pass is in its own script, so confidence decides",
  );
  assert.equal(
    pickTranscription([
      { language: "ar", text: "Jien, saqbal li jki trfodi.", confidence: -0.2 },
      { language: "en", text: "Yani, sa'b alaiki terfodi.", confidence: -1.4 },
    ])?.text,
    "Yani, sa'b alaiki terfodi.",
    "an Arabic pass that came back in Latin letters never wins",
  );
  /* No confidence reported: the first asked, the patient's language. */
  assert.equal(
    pickTranscription([
      { language: "ar", text: "أنا تعبانة", confidence: null },
      { language: "en", text: "I am tired", confidence: null },
    ])?.text,
    "أنا تعبانة",
  );
  /* A silent pass never beats one that heard words. */
  assert.equal(
    pickTranscription([
      { language: "ar", text: "", confidence: -0.01 },
      { language: "en", text: "Tired.", confidence: -0.3 },
    ])?.text,
    "Tired.",
  );
});

test("board 824 / 868 the session's candidates: Arabic always with English beside it", async () => {
  const { transcriptionRequests } = await transcriber();
  assert.deepEqual(
    transcriptionRequests(null, ["ar-EG", "en", "ar"]).map((r) => r.language),
    ["ar", "en"],
  );
  assert.deepEqual(transcriptionRequests(null, ["ar"]).map((r) => r.language), ["ar"]);
  assert.deepEqual(transcriptionRequests("fr", ["ar", "en"]).map((r) => r.language), ["fr"]);
});
