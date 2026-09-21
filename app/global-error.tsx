"use client";

/**
 * Last-resort error boundary. It replaces the root layout, so it has to ship
 * its own <html>/<body>.
 *
 * The message is deliberately generic: an error inside the portal can carry
 * clinical detail in its message, and this renders on a page we do not control
 * the audience of.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
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
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
            The page could not be displayed. Nothing you were working on has been lost.
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
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
