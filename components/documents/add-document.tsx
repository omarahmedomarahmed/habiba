"use client";

import { useRef, useState, useTransition } from "react";
import { Mic, Paperclip, PenLine } from "lucide-react";

import { Card } from "@/components/ui";
import { MAX_DOCUMENT_BYTES } from "@/lib/documents/formats";

/**
 * Three ways in: upload, type, dictate. PLAN.md 8.1 / 8.2.
 *
 * ## Why dictation is browser-side
 *
 * The Web Speech API runs on the device, so a therapist dictating a history
 * between sessions sends us text rather than audio — no upload, no transcribe
 * bill, no recording of their voice sitting in a bucket. It is stored as
 * `dictated` rather than `typed` because provenance matters (8.7): dictated
 * text carries transcription errors that typed text does not, and whoever
 * reads it later should know which they are looking at.
 *
 * Browsers without it simply do not show the button. A feature that appears
 * and then fails is worse than one that is absent.
 */
export function AddDocument({
  onUpload,
  onNote,
}: {
  onUpload: (formData: FormData) => Promise<{ error?: string; ok?: boolean }>;
  onNote: (input: { title: string; body: string; dictated?: boolean }) => Promise<{
    error?: string;
    ok?: boolean;
  }>;
}) {
  const [mode, setMode] = useState<"none" | "file" | "text">("none");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dictated, setDictated] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const speechAvailable =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const submitFile = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a file.");

    const data = new FormData();
    data.set("file", file);
    data.set("title", title.trim() || file.name);

    startTransition(async () => {
      setError(null);
      const result = await onUpload(data);
      if (result.error) setError(result.error);
      else reset();
    });
  };

  const submitText = () =>
    startTransition(async () => {
      setError(null);
      const result = await onNote({ title, body, dictated });
      if (result.error) setError(result.error);
      else reset();
    });

  const reset = () => {
    setMode("none");
    setTitle("");
    setBody("");
    setDictated(false);
    setError(null);
  };

  const dictate = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition =
      (window as unknown as { SpeechRecognition?: new () => never }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => never }).webkitSpeechRecognition;
    if (!Recognition) return;

    // Typed loosely on purpose: the Web Speech API has no stable TypeScript
    // definition across browsers, and a hand-written one would be a fiction
    // maintained here forever.
    const recognition = new Recognition() as unknown as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: (event: unknown) => void;
      onend: () => void;
    };

    recognition.continuous = true;
    recognition.interimResults = false;
    // Arabic and English mix mid-sentence in this product. The browser takes
    // one language, so it gets the one the interface is in and the therapist
    // corrects the rest — which is the honest failure, not a silent one.
    recognition.lang = document.documentElement.lang || "en-US";

    recognition.onresult = (event: unknown) => {
      const results = (event as { results: ArrayLike<ArrayLike<{ transcript: string }>> }).results;
      let text = "";
      for (let i = 0; i < results.length; i += 1) {
        text += `${results[i]?.[0]?.transcript ?? ""} `;
      }
      setBody(text.trim());
      setDictated(true);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  if (mode === "none") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("file")}
          className="tap-target flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Paperclip className="h-4 w-4" aria-hidden />
          Add a file
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className="tap-target flex h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <PenLine className="h-4 w-4" aria-hidden />
          Write or dictate
        </button>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={mode === "file" ? "What is this? (optional)" : "Title"}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />

      {mode === "file" ? (
        <>
          <input
            ref={fileRef}
            type="file"
            className="mt-2 w-full text-sm text-slate-600 file:me-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            A photo of a page is fine. Up to {Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.
            Photos and scans are stored and shown, but the copilot cannot read inside them.
          </p>
        </>
      ) : (
        <>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              // Edited by hand after dictating: it is typed text now, and
              // labelling it "dictated" would misstate where the words came
              // from.
              setDictated(false);
            }}
            placeholder="Their history, in your own words."
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed"
          />
          {speechAvailable ? (
            <button
              type="button"
              onClick={dictate}
              className={`tap-target mt-2 flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
                listening ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"
              }`}
            >
              <Mic className="h-3.5 w-3.5" aria-hidden />
              {listening ? "Stop dictating" : "Dictate"}
            </button>
          ) : null}
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={mode === "file" ? submitFile : submitText}
          className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="tap-target h-10 rounded-xl px-3 text-sm font-medium text-slate-600"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
