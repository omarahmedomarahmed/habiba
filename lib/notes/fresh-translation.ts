import { sql, type SQL } from "drizzle-orm";

import { sessionNotes, type NoteContent } from "@/lib/db/schema";

/**
 * DD-2: the English copy of a note, only while it was translated from the note
 * as it stands. `content_en_source` is md5(content::text) when the translation
 * was written; any edit changes `content`, so a stale translation reads as null
 * in every view and export until it is written again (on signing).
 *
 * Every read of `session_notes.content_en` goes through this.
 */
export const FRESH_CONTENT_EN = sql<NoteContent | null>`CASE WHEN ${sessionNotes.contentEnSource} = md5(${sessionNotes.content}::text) THEN ${sessionNotes.contentEn} END`;

/** The value to store in `content_en_source` beside a translation of `content`. */
export function translationSourceOf(content: NoteContent): SQL<string> {
  return sql<string>`md5(${JSON.stringify(content)}::jsonb::text)`;
}
