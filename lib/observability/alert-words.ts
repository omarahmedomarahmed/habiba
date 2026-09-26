import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 Board 423: an operations alert in plain words, and whether it is still open.
 *
 * The watchdog's alerts reached staff only as raw keys (`cron-overdue:extract`,
 * `digest:one-hand`) at the foot of /admin/errors, and they read as live after
 * every job had run again. So:
 *
 *   - a key is said as a sentence, with the job named for what it does
 *   - a STANDING alert (a job late, errors in the last hour) is open while the
 *     watchdog would still raise it now, and cleared the moment it would not.
 *     That is computed from the same `findProblems` the email is sent from, so
 *     the page and the inbox cannot disagree about what is wrong.
 *   - a REPORT (the daily one-hand digest) is not a fault and is never open:
 *     it was sent, and that is all there is to say about it.
 *
 * Pure, so the words and the rule are a test.
 */
export type AlertStatus = "open" | "cleared" | "report";

const JOB_WORDS: Record<string, MessageKey> = {
  crisis: "aops.job.crisis",
  reminders: "aops.job.reminders",
  billing: "aops.job.billing",
  retention: "aops.job.retention",
  extract: "aops.job.extract",
};

export type AlertWords = { key: MessageKey; values: Record<string, string>; job?: MessageKey };

export function alertWords(key: string): AlertWords {
  if (key.startsWith("cron-overdue:")) {
    const job = key.slice("cron-overdue:".length);
    const words = JOB_WORDS[job];
    return words
      ? { key: "aops.cronOverdue", values: {}, job: words }
      : { key: "aops.cronOverdueOther", values: { job } };
  }
  if (key === "server-errors") return { key: "aops.serverErrors", values: {} };
  if (key === "digest:one-hand") return { key: "aops.oneHand", values: {} };
  return { key: "aops.other", values: { key } };
}

export function isReport(key: string): boolean {
  return key.startsWith("digest:");
}

export function alertStatus(key: string, standing: ReadonlySet<string>): AlertStatus {
  if (isReport(key)) return "report";
  return standing.has(key) ? "open" : "cleared";
}

/**
 * One row per alert key, newest sending first, with its status. The watchdog
 * writes one row per key per day, so a job late for three days is one alert on
 * the screen rather than three.
 */
export function alertBoard(
  sent: { key: string; sentAt: Date }[],
  standing: ReadonlySet<string>,
): { key: string; sentAt: Date | null; status: AlertStatus }[] {
  const byKey = new Map<string, Date | null>();
  for (const row of sent) {
    const seen = byKey.get(row.key);
    if (!seen || row.sentAt > seen) byKey.set(row.key, row.sentAt);
  }
  /* A problem standing now whose email is not sent yet is open all the same. */
  for (const key of standing) if (!byKey.has(key)) byKey.set(key, null);
  const order = (at: Date | null) => (at ? at.getTime() : Number.MAX_SAFE_INTEGER);
  return [...byKey.entries()]
    .map(([key, sentAt]) => ({ key, sentAt, status: alertStatus(key, standing) }))
    .sort((a, b) => order(b.sentAt) - order(a.sentAt));
}
