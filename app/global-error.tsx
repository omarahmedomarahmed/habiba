"use client";

import { useEffect } from "react";

import { recoverFromChunkError } from "@/lib/chunk-recovery";
import { LAST_RESORT_HELP } from "@/lib/crisis/line";
import { LAST_RESORT_ERROR } from "@/lib/i18n/last-resort";

/**
 * Last-resort error boundary. It replaces the root layout, so it has to ship
 * its own <html>/<body>.
 *
 * The message is deliberately generic: an error inside the portal can carry
 * clinical detail in its message, and this renders on a page we do not control
 * the audience of.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  /* 🔴 B7: see `lib/chunk-recovery.ts`. A first load whose script never arrived reloads once. */
  useEffect(() => {
    recoverFromChunkError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          margin: 0,
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "24rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            {LAST_RESORT_ERROR.title.en} · <span lang="ar">{LAST_RESORT_ERROR.title.ar}</span>
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
            {LAST_RESORT_ERROR.body.en} <span lang="ar">{LAST_RESORT_ERROR.body.ar}</span>
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              height: "2.75rem",
              padding: "0 1.25rem",
              borderRadius: "0.75rem",
              border: 0,
              /* brand-500 with navy ink, the one primary-button pairing.
                 Inline because this component replaces the whole document,
                 stylesheet included, so no token is loaded by the time it
                 renders. Keep it in step with BUTTON_VARIANTS.primary. */
              background: "#2EC4B6",
              color: "#0A2342",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            {LAST_RESORT_ERROR.retry.en} · <span lang="ar">{LAST_RESORT_ERROR.retry.ar}</span>
          </button>
          {/*
            🔴 W1-29: help does not wait for the page to come back (P5).
            Numbers only, inline, because nothing else loads here: the
            always-open lines for the two launch countries, then the rule
            that is true from any phone.
          */}
          <div
            role="note"
            style={{ marginTop: "1.5rem", padding: "0.875rem 1rem", borderRadius: "0.75rem", background: "#dc2626", color: "#fff", fontSize: "0.875rem", textAlign: "start" }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>
              {LAST_RESORT_HELP.title.en} · <span lang="ar">{LAST_RESORT_HELP.title.ar}</span>
            </p>
            {LAST_RESORT_HELP.countries.map((country) => (
              <p key={country.name.en} style={{ margin: "0.375rem 0 0" }}>
                {country.name.en} · <span lang="ar">{country.name.ar}</span>:{" "}
                {country.lines.map((line, index) => (
                  <span key={line.tel}>
                    {index > 0 ? " · " : null}
                    <a href={`tel:${line.tel}`} style={{ color: "#fff", fontWeight: 700 }}>
                      {line.label}
                    </a>
                  </span>
                ))}
              </p>
            ))}
            <p style={{ margin: "0.25rem 0 0" }}>
              {LAST_RESORT_HELP.elsewhere.en} <span lang="ar">{LAST_RESORT_HELP.elsewhere.ar}</span>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
