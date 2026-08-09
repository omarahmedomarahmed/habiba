"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Copy,
  Info,
  Loader2,
  Mic,
  Pencil,
  Send,
  Settings2,
  Square,
  Volume2,
  X,
} from "lucide-react";

import { askCopilot, correctCopilot } from "@/app/(app)/copilot/actions";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { SessionRecorder } from "@/lib/audio/recorder";
import type { Citation } from "@/lib/db/schema";
import { cn, formatDate, formatDuration } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: "therapist" | "copilot" | "session_note" | "correction";
  content: string;
  citations: Citation[];
  createdAt: string;
};

const VOICES = [
  { value: "british_female", label: "British · female" },
  { value: "british_male", label: "British · male" },
  { value: "american_female", label: "American · female" },
  { value: "american_male", label: "American · male" },
] as const;

export function CopilotChat({
  patientId,
  patientName,
  initialMessages,
  templates,
  quota,
  initialVoice,
  initialSpeed,
}: {
  patientId: string;
  patientName: string;
  initialMessages: ChatMessage[];
  templates: { label: string; text: string }[];
  quota: { used: number; limit: number | null };
  initialVoice: string;
  initialSpeed: number;
}) {
  const [pending, startTransition] = useTransition();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [used, setUsed] = useState(quota.used);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<SessionRecorder | null>(null);

  const [voice, setVoice] = useState(initialVoice);
  const [speed, setSpeed] = useState(initialSpeed);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      void recorderRef.current?.stop();
      audioRef.current?.pause();
    };
  }, []);

  /* ------------------------------------------------------------- sending -- */

  const send = (text: string) => {
    const question = text.trim();
    if (!question || pending) return;

    setError(null);
    setSuggested([]);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "therapist",
      content: question,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");

    startTransition(async () => {
      const result = await askCopilot(patientId, question);

      if (result.quotaExhausted) {
        setExhausted(true);
        setError(result.error ?? null);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        return;
      }
      if (result.error || !result.answer) {
        setError(result.error ?? "Something went wrong.");
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        return;
      }

      setMessages((m) => [
        ...m,
        {
          id: `local-a-${Date.now()}`,
          role: "copilot",
          content: result.answer!.content,
          citations: result.answer!.citations,
          createdAt: new Date().toISOString(),
        },
      ]);
      setSuggested(result.suggestedPrompts ?? []);
      if (typeof result.used === "number") setUsed(result.used);
    });
  };

  /* --------------------------------------------------------- voice input -- */

  const startVoice = async () => {
    setError(null);
    const recorder = new SessionRecorder({
      // One long chunk: this is a dictated question, not a live session, so we
      // want the whole thing transcribed in one pass with full context.
      chunkSeconds: 120,
      onChunk: async ({ blob, durationSeconds }) => {
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "prompt.wav");
          form.append("duration", String(durationSeconds));
          const response = await fetch("/api/copilot/voice", {
            method: "POST",
            body: form,
            credentials: "same-origin",
          });
          if (!response.ok) throw new Error("failed");
          const data = (await response.json()) as { text?: string };
          // Dropped into the box, not sent. The therapist reads it back and
          // edits before anything is asked.
          if (data.text) setDraft((d) => (d ? `${d} ${data.text}` : data.text!));
          else setError("Nothing was picked up. Try again closer to the microphone.");
        } catch {
          setError("Could not turn that into text. Try again.");
        } finally {
          setTranscribing(false);
        }
      },
    });

    try {
      await recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("No microphone access. Allow the microphone and try again.");
    }
  };

  const stopVoice = async () => {
    setRecording(false);
    await recorderRef.current?.stop();
    recorderRef.current = null;
  };

  /* ---------------------------------------------------------- read aloud -- */

  const readAloud = async (message: ChatMessage) => {
    if (speakingId === message.id) {
      audioRef.current?.pause();
      setSpeakingId(null);
      return;
    }

    setSpeakingId(message.id);
    try {
      const response = await fetch("/api/copilot/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ text: message.content, voice, speed }),
      });
      if (!response.ok) throw new Error("failed");

      const url = URL.createObjectURL(await response.blob());
      audioRef.current?.pause();
      const audio = new Audio(url);
      audio.playbackRate = 1; // speed is applied server-side by the model
      audio.onended = () => {
        setSpeakingId(null);
        URL.revokeObjectURL(url);
      };
      audioRef.current = audio;
      await audio.play();
    } catch {
      setSpeakingId(null);
      setError("Could not read that aloud.");
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const remaining = quota.limit === null ? null : Math.max(0, quota.limit - used);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="flex min-h-0 flex-col">
        <div className="flex-1 space-y-3">
          {messages.length === 0 ? (
            <Card className="px-5 py-8 text-center">
              <p className="text-base font-semibold text-slate-900">
                Ask me about {patientName}
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
                I have read every session in this chart and nothing outside it. Every answer will
                show you exactly which moment it came from.
              </p>
            </Card>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onReadAloud={() => readAloud(message)}
                speaking={speakingId === message.id}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {suggested.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggested.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setDraft(prompt)}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {/* ------------------------------------------------------- composer */}
        <div className="sticky bottom-0 mt-3 bg-slate-50/95 pt-2 pb-2 backdrop-blur">
          {exhausted ? (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-900">
                You have used all {quota.limit} messages for {patientName} this month
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Pay as you go includes {quota.limit} copilot messages per patient per month.
                Unlimited removes the cap on every patient.
              </p>
              <a href="/billing" className="mt-3 inline-block">
                <Button>See Unlimited</Button>
              </a>
            </Card>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-2">
              <Textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(draft);
                }}
                placeholder={`Ask about ${patientName}…`}
                className="border-0 focus:ring-0"
              />

              <div className="flex items-center gap-2 px-1 pt-1">
                <button
                  type="button"
                  onClick={recording ? stopVoice : startVoice}
                  aria-pressed={recording}
                  aria-label={recording ? "Stop recording" : "Dictate a question"}
                  className={cn(
                    "tap-target flex items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium",
                    recording
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {recording ? (
                    <>
                      <Square className="h-3.5 w-3.5" aria-hidden /> Stop
                    </>
                  ) : (
                    <Mic className="h-4 w-4" aria-hidden />
                  )}
                </button>

                {transcribing ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    Writing it out…
                  </span>
                ) : recording ? (
                  <span className="text-xs text-slate-500">
                    Listening — press Stop and I will type it out for you to check.
                  </span>
                ) : null}

                <span className="flex-1" />

                {remaining !== null ? (
                  <span className="text-xs text-slate-400">{remaining} left</span>
                ) : null}

                <Button size="sm" disabled={pending || !draft.trim()} onClick={() => send(draft)}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  Ask
                </Button>
              </div>
            </div>
          )}

          <p className="px-1 pt-2 text-[11px] leading-relaxed text-slate-400">
            Every answer cites the exact moment it came from, and a citation that does not match a
            real transcript line is discarded rather than shown. It can still be wrong — read the
            source before you rely on it, and correct it when it is.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------ aside */}
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Read aloud</p>
            <button
              type="button"
              onClick={() => setShowVoiceSettings((v) => !v)}
              aria-label="Voice settings"
              className="tap-target flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <Settings2 className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {showVoiceSettings ? (
            <div className="mt-3 space-y-3">
              <Field label="Voice" htmlFor="voice">
                <select
                  id="voice"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {VOICES.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Speed · ${speed.toFixed(2)}×`} htmlFor="speed">
                <input
                  id="speed"
                  type="range"
                  min={0.75}
                  max={2}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </Field>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Press the speaker on any answer. Nothing speaks on its own.
            </p>
          )}
        </Card>

        <Card className="p-3">
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Prompts</p>
          <ul className="mt-2 space-y-1">
            {templates.map((template) => (
              <li key={template.label} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDraft(template.text)}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  {template.label}
                </button>
                <button
                  type="button"
                  onClick={() => copy(template.text, template.label)}
                  aria-label={`Copy "${template.label}" prompt`}
                  className="tap-target flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600"
                >
                  {copied === template.label ? (
                    <span className="text-[10px] font-semibold text-teal-600">copied</span>
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <CorrectionBox patientId={patientId} />
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- bubbles -- */

function MessageBubble({
  message,
  onReadAloud,
  speaking,
}: {
  message: ChatMessage;
  onReadAloud: () => void;
  speaking: boolean;
}) {
  const [openCitation, setOpenCitation] = useState<number | null>(null);

  if (message.role === "therapist") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2.5 text-[15px] leading-relaxed text-white">
          {message.content}
        </p>
      </div>
    );
  }

  if (message.role === "session_note") {
    return (
      <Card className="border-teal-200 bg-teal-50/60 px-4 py-3">
        <p className="text-[11px] font-bold tracking-wider text-teal-700 uppercase">
          Noted during a session
        </p>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-teal-900">
          {message.content}
        </p>
      </Card>
    );
  }

  if (message.role === "correction") {
    return (
      <Card className="border-amber-200 bg-amber-50/60 px-4 py-3">
        <p className="text-[11px] font-bold tracking-wider text-amber-700 uppercase">
          You corrected me
        </p>
        <p className="mt-1 text-sm leading-relaxed text-amber-900">{message.content}</p>
      </Card>
    );
  }

  return (
    <Card className="px-4 py-3.5">
      <p className="text-[15px] leading-relaxed whitespace-pre-line text-slate-800">
        {message.content}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {message.citations.map((citation, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenCitation(openCitation === i ? null : i)}
            aria-expanded={openCitation === i}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
              openCitation === i
                ? "bg-brand-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            <Info className="h-3 w-3" aria-hidden />
            {formatDate(citation.sessionDate)} · {formatDuration(citation.atSeconds)}
          </button>
        ))}

        {message.citations.length === 0 ? (
          <Badge tone="amber">No source — treat with care</Badge>
        ) : null}

        <span className="flex-1" />

        <button
          type="button"
          onClick={onReadAloud}
          aria-label={speaking ? "Stop reading" : "Read this aloud"}
          className={cn(
            "tap-target flex items-center justify-center rounded-lg px-2",
            speaking ? "text-brand-600" : "text-slate-300 hover:text-slate-600",
          )}
        >
          <Volume2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {openCitation !== null && message.citations[openCitation] ? (
        <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {message.citations[openCitation]!.speaker === "patient"
              ? "The patient said"
              : message.citations[openCitation]!.speaker === "therapist"
                ? "You said"
                : "Someone said"}{" "}
            · {formatDate(message.citations[openCitation]!.sessionDate)} at{" "}
            {formatDuration(message.citations[openCitation]!.atSeconds)}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700 italic">
            “{message.citations[openCitation]!.quote}”
          </p>
        </div>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------- correction -- */

function CorrectionBox({ patientId }: { patientId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50"
      >
        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Correct the copilot
      </button>
    );
  }

  return (
    <Card className="space-y-2.5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Correct me</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="tap-target flex items-center justify-center text-slate-300 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {done ? (
        <p className="text-sm text-teal-700">
          Noted. I will keep that in mind for this patient from now on.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-slate-500">
            Tell me what I got wrong. This sticks for this patient — it changes how I answer next
            time, not just now.
          </p>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="The sister reference is a different client."
          />
          <Button
            size="sm"
            full
            disabled={pending || !text.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await correctCopilot(patientId, text);
                if (!result.error) {
                  setDone(true);
                  setText("");
                }
              })
            }
          >
            {pending ? "Saving…" : "Save correction"}
          </Button>
        </>
      )}
    </Card>
  );
}
