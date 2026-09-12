"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Mic } from "lucide-react";

import { addJournal } from "@/app/(patient)/patient/journal/actions";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * Writing a journal. PLAN.md 26.5, 26.8.
 *
 * ## 🔴 The sentence that is not on this screen
 *
 * There is no "your therapist reads this", no shield icon, no "we are here for
 * you", and no confirmation that anybody was told about anything. C123: the
 * page never says or implies that somebody is watching. What it says instead
 * is the true, narrow thing — who *can* read it, which is a therapist this
 * person has given access to, and when.
 *
 * ## Dictation
 *
 * The browser's own speech recognition, which means the audio never leaves the
 * device and there is no recording to store (C124's private-storage rule has
 * nothing to store; the text it produces gets a document's auth and audit).
 * Editing dictated text by hand makes it typed, because labelling it dictated
 * would misstate where the words came from.
 */
export function JournalWriter() {
  const t = useT();
  const [state, submit] = useActionState(addJournal, {});
  const [body, setBody] = useState("");
  const [dictated, setDictated] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const recognition = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSpeechAvailable(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (state.ok) setBody("");
  }, [state.ok]);

  const dictate = () => {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => never;
      webkitSpeechRecognition?: new () => never;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const engine: any = new (Ctor as any)();
    engine.continuous = true;
    engine.interimResults = false;
    engine.onresult = (event: any) => {
      let heard = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        heard += event.results[i][0].transcript;
      }
      setBody((current) => (current ? `${current} ${heard}`.trim() : heard.trim()));
      setDictated(true);
    };
    engine.onend = () => setListening(false);
    engine.start();
    recognition.current = engine;
    setListening(true);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  };

  return (
    <Card className="p-4">
      <form action={submit}>
        <input type="hidden" name="dictated" value={dictated ? "1" : "0"} />
        <textarea
          name="body"
          rows={7}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setDictated(false);
          }}
          placeholder={t("pjournal.placeholder")}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-relaxed"
          required
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
            {listening ? "Stop" : "Say it instead"}
          </button>
        ) : null}

        {state.error ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <Save />
      </form>
    </Card>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button className="mt-3" full type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save this"}
    </Button>
  );
}
