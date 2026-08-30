"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock } from "lucide-react";

import { configureKey, submitKeys } from "@/app/(admin)/admin/tv/actions";
import { Button, Card, Field, Input } from "@/components/ui";

export function Gate({ configured }: { configured: { a: boolean; b: boolean } }) {
  const ready = configured.a && configured.b;
  return ready ? <Unlock /> : <Setup configured={configured} />;
}

function Unlock() {
  const [pending, start] = useTransition();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-sm py-16">
      <Card className="p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">Total View</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Both keys are required. Everything past this point is read-only and every read is
          recorded.
        </p>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <Field label="First key" htmlFor="k-a">
            <Input
              id="k-a"
              type="password"
              autoComplete="off"
              value={a}
              onChange={(e) => setA(e.target.value)}
            />
          </Field>
          <Field label="Second key" htmlFor="k-b">
            <Input
              id="k-b"
              type="password"
              autoComplete="off"
              value={b}
              onChange={(e) => setB(e.target.value)}
            />
          </Field>
        </div>

        <Button
          full
          size="lg"
          className="mt-4"
          disabled={pending || !a || !b}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await submitKeys(a, b);
              if (result.error) setError(result.error);
              setA("");
              setB("");
            })
          }
        >
          <KeyRound className="h-4 w-4" aria-hidden />
          {pending ? "Checking…" : "Open"}
        </Button>
      </Card>
    </div>
  );
}

function Setup({ configured }: { configured: { a: boolean; b: boolean } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [slot, setSlot] = useState<"a" | "b">(configured.a ? "b" : "a");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-sm py-16">
      <Card className="p-6">
        <p className="text-lg font-bold tracking-tight text-slate-900">Set the keys</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Two are needed. The first can be changed here later; the second is written once and
          after that changes only in the database.
        </p>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
            {done}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2 rounded-2xl bg-slate-100 p-1">
          {(["a", "b"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={configured[s] && s === "b"}
              onClick={() => setSlot(s)}
              className={
                slot === s
                  ? "flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm"
                  : "flex-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 disabled:opacity-40"
              }
            >
              {s === "a" ? "First" : "Second"}
              {configured[s] ? " ✓" : ""}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <Field label="Value" htmlFor="k-set">
          <Input
            id="k-set"
            type="password"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          </Field>
        </div>

        <Button
          full
          className="mt-4"
          disabled={pending || !value}
          onClick={() =>
            start(async () => {
              setError(null);
              setDone(null);
              const result = await configureKey(slot, value);
              if (result.error) setError(result.error);
              else {
                setDone(`${slot === "a" ? "First" : "Second"} key set.`);
                setValue("");
                // Re-read from the server rather than guessing: which slots are
                // filled decides which one this form writes next, and a stale
                // answer writes to the wrong one.
                router.refresh();
              }
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </Card>
    </div>
  );
}
