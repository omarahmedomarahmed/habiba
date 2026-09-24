import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { dbFor } from "@/lib/db";
import { regionOfOrganization } from "@/lib/db/directory";
import { noteTemplates, users } from "@/lib/db/schema";
import {
  BUILT_IN_FORMATS,
  TEMPLATE_PREFIX,
  parseTemplateSections,
  resolveFormat,
  templateFormat,
  type NoteFormat,
  type TemplateRow,
} from "@/lib/notes/formats";

/**
 * 🔴 W2-F01 / D7: which formats a clinician can draft in, and their default.
 *
 * The built-ins are code-free data in `lib/notes/formats.ts`; a clinician's own
 * templates are rows here. Their own only: a template is a clinician's way of
 * writing, not a clinic's policy, and nobody else's template ever resolves for
 * them (an unknown key is SOAP).
 *
 * Routed on the organisation (C154), like the clinician's own row.
 */

async function dbForOrg(organizationId: string) {
  return dbFor(await regionOfOrganization(organizationId));
}

async function templateRows(organizationId: string, userId: string): Promise<TemplateRow[]> {
  const db = await dbForOrg(organizationId);
  return db
    .select({ id: noteTemplates.id, label: noteTemplates.label, sections: noteTemplates.sections })
    .from(noteTemplates)
    .where(
      and(
        eq(noteTemplates.userId, userId),
        eq(noteTemplates.organizationId, organizationId),
        isNull(noteTemplates.archivedAt),
      ),
    )
    .orderBy(asc(noteTemplates.createdAt));
}

/**
 * Every format this clinician can draft in, their default, and their templates.
 * The default falls back to SOAP when it names a template that has gone.
 */
export async function formatsFor(organizationId: string, userId: string) {
  const db = await dbForOrg(organizationId);
  const [[row], templates] = await Promise.all([
    db.select({ noteFormat: users.noteFormat }).from(users).where(eq(users.id, userId)).limit(1),
    templateRows(organizationId, userId),
  ]);
  const formats: NoteFormat[] = [...BUILT_IN_FORMATS, ...templates.map(templateFormat)];
  const fallback = resolveFormat(row?.noteFormat, templates);
  return { formats, templates, defaultFormat: fallback };
}

/** One format by key, as this clinician may use it. Unknown is SOAP. */
export async function formatFor(
  organizationId: string,
  userId: string,
  key: string | null | undefined,
): Promise<NoteFormat> {
  if (!key?.startsWith(TEMPLATE_PREFIX)) return resolveFormat(key);
  return resolveFormat(key, await templateRows(organizationId, userId));
}

/**
 * The name of each format key, for a list of notes. A template's name is read
 * from its row whether or not it has been archived since: the note was written
 * in it, and says so. `null` for a built-in, whose name the screen translates.
 */
export async function templateLabels(
  organizationId: string,
  keys: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(keys)]
    .filter((key) => key.startsWith(TEMPLATE_PREFIX))
    .map((key) => key.slice(TEMPLATE_PREFIX.length));
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const db = await dbForOrg(organizationId);
  const rows = await db
    .select({ id: noteTemplates.id, label: noteTemplates.label })
    .from(noteTemplates)
    .where(and(inArray(noteTemplates.id, ids), eq(noteTemplates.organizationId, organizationId)));
  for (const row of rows) out.set(`${TEMPLATE_PREFIX}${row.id}`, row.label);
  return out;
}

/* ------------------------------------------------------------- settings -- */

export async function setDefaultFormat(actor: Actor, key: string): Promise<boolean> {
  const format = await formatFor(actor.organizationId, actor.userId, key);
  if (format.key !== key) return false;
  const db = await dbForOrg(actor.organizationId);
  await db
    .update(users)
    .set({ noteFormat: format.key, updatedAt: new Date() })
    .where(eq(users.id, actor.userId));
  await audit({
    actor,
    category: "clinical",
    action: "settings.note_format",
    resourceType: "user",
    resourceId: actor.userId,
    reason: format.builtIn ? format.key : "own template",
  });
  return true;
}

export async function createTemplate(
  actor: Actor,
  input: { label: string; sections: string },
): Promise<{ ok: true; key: string } | { ok: false }> {
  const label = input.label.trim().slice(0, 40);
  const sections = parseTemplateSections(input.sections);
  if (!label || sections.length === 0) return { ok: false };

  const db = await dbForOrg(actor.organizationId);
  const [row] = await db
    .insert(noteTemplates)
    .values({ organizationId: actor.organizationId, userId: actor.userId, label, sections })
    .returning({ id: noteTemplates.id });
  await audit({
    actor,
    category: "clinical",
    action: "settings.note_template.create",
    resourceType: "note_template",
    resourceId: row!.id,
  });
  return { ok: true, key: `${TEMPLATE_PREFIX}${row!.id}` };
}

/**
 * Archived, not deleted: notes written from it keep their own headings. A
 * default that named it goes back to SOAP.
 */
export async function archiveTemplate(actor: Actor, id: string): Promise<boolean> {
  const db = await dbForOrg(actor.organizationId);
  const archived = await db
    .update(noteTemplates)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(noteTemplates.id, id),
        eq(noteTemplates.userId, actor.userId),
        isNull(noteTemplates.archivedAt),
      ),
    )
    .returning({ id: noteTemplates.id });
  if (archived.length === 0) return false;

  await db
    .update(users)
    .set({ noteFormat: "soap", updatedAt: new Date() })
    .where(and(eq(users.id, actor.userId), eq(users.noteFormat, `${TEMPLATE_PREFIX}${id}`)));
  await audit({
    actor,
    category: "clinical",
    action: "settings.note_template.archive",
    resourceType: "note_template",
    resourceId: id,
  });
  return true;
}
