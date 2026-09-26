/**
 * 🔴 Board 588: what the person who wrote to us reads, in the order it happened.
 *
 * The reply page showed the close summary first under "Our reply" and the real
 * answer below it under "Update", because events come newest first and the close
 * was labelled as the reply. It also showed our own bookkeeping ("They replied,
 * the clock restarts"), which has no author. So: only what a person on our side
 * wrote, oldest first, the answers as our reply and the close as the close.
 */
export type ThreadEvent = {
  kind: string;
  actorUserId: string | null;
  note: string | null;
  createdAt: Date;
};

export type SenderEntry = { kind: "reply" | "closed"; note: string; createdAt: Date };

export function senderThread(events: ThreadEvent[]): SenderEntry[] {
  return events
    .filter(
      (event) =>
        (event.kind === "replied" || event.kind === "closed") &&
        event.actorUserId !== null &&
        Boolean(event.note?.trim()),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((event) => ({
      kind: event.kind === "closed" ? ("closed" as const) : ("reply" as const),
      note: event.note!.trim(),
      createdAt: event.createdAt,
    }));
}
