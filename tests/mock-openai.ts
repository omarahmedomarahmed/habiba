import { createServer, type Server } from "node:http";

/**
 * A stand-in for the OpenAI API, used by the end-to-end test.
 *
 * The app points at this by setting `OPENAI_BASE_URL`. It lets the whole
 * clinical loop — microphone, WAV encoding, upload, transcript, note
 * generation, approval — run for real without spending money or needing a key,
 * and it records what the app actually sent so the test can assert on it.
 */
export type MockState = {
  transcriptionRequests: { bytes: number; contentType: string }[];
  chatRequests: { model: string; body: string }[];
};

const NOTE = {
  soap: {
    subjective:
      "Patient reported disrupted sleep over the past week and described ruminative thinking about an upcoming work deadline.",
    objective:
      "Alert and engaged. Affect mildly constricted, congruent with reported mood. No psychomotor agitation observed.",
    assessment:
      "Anxiety-driven sleep disruption in the context of a time-limited stressor. No risk indicators elicited.",
    plan: "Continue the agreed wind-down routine four nights per week and review the sleep pattern next session.",
  },
  summary:
    "Follow-up session addressing a recurrence of sleep disruption linked to anticipatory work anxiety.",
  talkingPoints: ["Sleep disruption", "Work deadline", "Wind-down routine adherence"],
  observations: "Engaged and collaborative throughout.",
  impressions: "Consistent with the existing formulation. Provisional, for clinician review.",
  recommendations: ["Maintain the wind-down routine on four nights", "Record which nights are completed"],
  followUp: "One week",
};

export function startMockOpenAi(port: number): { server: Server; state: MockState } {
  const state: MockState = { transcriptionRequests: [], chatRequests: [] };

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = req.url ?? "";

      if (url.includes("/audio/transcriptions")) {
        state.transcriptionRequests.push({
          bytes: body.length,
          contentType: req.headers["content-type"] ?? "",
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            text: `Transcribed chunk ${state.transcriptionRequests.length}: the patient described their week.`,
          }),
        );
        return;
      }

      if (url.includes("/chat/completions")) {
        const text = body.toString("utf8");
        let model = "unknown";
        try {
          model = JSON.parse(text).model ?? "unknown";
        } catch {
          /* keep default */
        }
        state.chatRequests.push({ model, body: text });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: "chatcmpl-mock",
            object: "chat.completion",
            model,
            choices: [
              { index: 0, message: { role: "assistant", content: JSON.stringify(NOTE) }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 1200, completion_tokens: 400, total_tokens: 1600 },
          }),
        );
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: `unhandled mock route ${url}` } }));
    });
  });

  server.listen(port);
  return { server, state };
}

export { NOTE as MOCK_NOTE };
