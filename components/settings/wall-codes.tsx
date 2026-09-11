"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { killWallCode, newWallCode } from "@/app/(app)/settings/codes/actions";
import { Button, Card, Field, Input } from "@/components/ui";

/**
 * Wall codes, listed and killed. PLAN.md 25.17, C120.
 *
 * The revoke button is a form rather than a fetch, so it works on the tablet
 * at a reception desk with a flaky connection, which is exactly where somebody
 * realises a poster is out of date.
 */

export type WallCodeRow = {
  id: string;
  code: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
  url: string;
  /** Inline SVG, rendered on the server. Null once revoked: a dead code is not printable. */
  svg: string | null;
};

export function NewWallCode() {
  const [state, create] = useActionState(newWallCode, {});

  return (
    <Card className="p-4">
      <form action={create} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <Field label="What is this one for?" htmlFor="label">
            <Input id="label" name="label" placeholder="Waiting room poster" maxLength={80} />
          </Field>
        </div>
        <Mint />
      </form>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
    </Card>
  );
}

function Mint() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create a code"}
    </Button>
  );
}

export function WallCodeList({ codes }: { codes: WallCodeRow[] }) {
  if (codes.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">No codes yet</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Create one above, print it, and put it where people wait.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {codes.map((entry) => (
        <li key={entry.id}>
          <Card className="flex flex-wrap items-start gap-4 p-4">
            {entry.svg ? (
              <div
                className="h-28 w-28 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: entry.svg }}
              />
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-center text-xs font-medium text-slate-400">
                Revoked
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="font-mono text-lg font-bold tracking-[0.2em] text-slate-900">
                {entry.code}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">{entry.label ?? "No label"}</p>
              <p className="mt-1 text-xs break-all text-slate-400">{entry.url}</p>
              <p className="mt-1 text-xs text-slate-400">
                {entry.revokedAt
                  ? `Revoked ${entry.revokedAt.slice(0, 10)}`
                  : `Created ${entry.createdAt.slice(0, 10)}`}
              </p>

              {entry.revokedAt ? null : (
                <form action={killWallCode} className="mt-2.5">
                  <input type="hidden" name="id" value={entry.id} />
                  <button
                    type="submit"
                    className="text-sm font-semibold text-red-600 hover:underline"
                  >
                    Revoke this code
                  </button>
                </form>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
