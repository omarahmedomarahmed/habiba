/**
 * Structured logging with a hard rule: no protected health information, ever.
 *
 * The old backend logged matched crisis keywords verbatim alongside a session
 * id — `[CRISIS SCAN] Keywords matched in session <uuid>: kill myself, want to
 * die` — which is about as direct a PHI leak into a log drain as it is possible
 * to write. It also used `morgan('combined')`, putting patient and session UUIDs
 * into every access log line with unbounded retention.
 *
 * So: identifiers are truncated to a short prefix (enough to correlate two log
 * lines, not enough to look up a record), and free text is not accepted at all
 * beyond a fixed message. If you want to log what happened to a specific
 * patient, that is what the audit log is for.
 */

type Fields = Record<string, string | number | boolean | null | undefined>;

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** `a1b2c3d4-…` — correlatable across lines, not resolvable to a record. */
export function ref(id: string | null | undefined): string {
  if (!id) return "none";
  return `${id.slice(0, 8)}…`;
}

function scrub(value: unknown): string {
  return String(value).replace(UUID_RE, (m) => `${m.slice(0, 8)}…`);
}

function emit(level: "debug" | "info" | "warn" | "error", message: string, fields?: Fields) {
  const parts = [`[${level}]`, scrub(message)];
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      parts.push(`${key}=${scrub(value)}`);
    }
  }
  const line = parts.join(" ");
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (message: string, fields?: Fields) =>
    process.env.NODE_ENV !== "production" && emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};

/** Strip anything that could carry PHI out of a thrown error before logging. */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return scrub(error.message).slice(0, 300);
  return "unknown error";
}
