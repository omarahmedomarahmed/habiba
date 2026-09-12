/*
 * 🔴 30.1 — the CONTROL PLANE. One copy, read by every region.
 *
 * This module reads facts about the PRODUCT rather than about a person:
 * settings, content, taxonomy, language, the operator console. There is one
 * of each and Cairo reads the same rows as Virginia. The compiler would not
 * let this file compile without making that choice explicitly.
 */
import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb as db } from "@/lib/db";
import { locales as localesTable, uiStrings } from "@/lib/db/schema";
import { log } from "@/lib/logger";

import { DICTIONARIES, en, type MessageKey } from "./messages";
import { completeness, invalidateStrings, isSafetyKey, shippedKeys } from "./strings";

/**
 * Writing strings and languages. PLAN.md 21.3, 21.5, 21.7, 21.9–21.19.
 *
 * Every function here is called by an admin action and every one of them
 * audits. The rules that are worth stating are the refusals:
 *
 *   - **21.5** Clearing an override deletes the row. It never writes an empty
 *     string, so the shipped wording comes back rather than a blank button.
 *   - **21.7 / 21.18** A safety string — crisis, consent, recording, risk —
 *     can be reworded and can never be *removed*, and no bulk machine action
 *     may publish one. It can only be published by a named person, one at a
 *     time, having read it.
 *   - **21.17** A machine translation is a **draft**. It counts as missing on
 *     the completeness checklist until somebody approves it.
 */

export type AuthoringResult = { ok?: boolean; error?: string; count?: number };

type Actor = { userId: string; organizationId: string; role: string };

/**
 * Save one override. 21.3.
 *
 * 🔴 45.5 — a save is a draft. Publishing is a second, deliberate act.
 *
 * This used to default to `published`, and that was defensible while an
 * override only reached four marketing files. 45.3 changed what an override
 * is: it now reaches every client component too, which means the patient app's
 * buttons, the room's controls and every form label are editable text. A typo
 * in this box used to be a wrong word on a landing page. It can now be a blank
 * control in a live session.
 *
 * So the two states stop being a machine-translation detail and become the
 * shape of the screen: **write, look at it, publish it.** Nothing a person
 * types here is visible to anybody until somebody publishes it, because
 * `stringsFor` and `overridesFor` both read `status = 'published'` only.
 *
 * A caller may still pass `status` explicitly — `approveDrafts` does — but the
 * default is the safe one rather than the convenient one.
 */
export async function saveString(input: {
  key: string;
  locale: string;
  value: string;
  actor: Actor;
  status?: "draft" | "published";
}): Promise<AuthoringResult> {
  const value = input.value.trim();

  if (!shippedKeys().includes(input.key as MessageKey)) {
    return { error: "That key is not one the product uses." };
  }
  if (value === "") {
    return { error: "An empty override would blank the button. Clear it instead to restore the shipped wording." };
  }

  await db
    .insert(uiStrings)
    .values({
      key: input.key,
      locale: input.locale,
      value,
      status: input.status ?? "draft",
      source: "human",
      updatedBy: input.actor.userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [uiStrings.key, uiStrings.locale],
      set: {
        value,
        status: input.status ?? "draft",
        source: "human",
        model: null,
        updatedBy: input.actor.userId,
        updatedAt: new Date(),
      },
    });

  await audit({
    actor: input.actor as never,
    category: "admin",
    action: "string.saved",
    resourceType: "ui_string",
    resourceId: `${input.key}:${input.locale}`,
    reason: isSafetyKey(input.key) ? "safety string" : null,
  });

  await invalidateStrings();
  return { ok: true };
}

/**
 * 🔴 45.5 — publish one override, having read it.
 *
 * The other half of the draft default above. It flips one row, by one named
 * person, and it is the only path by which a human edit becomes visible to a
 * patient. Deliberately **not** a bulk action: `approveDrafts` exists for
 * machine batches and refuses safety strings for precisely this reason, and
 * adding a "publish everything" button here would recreate the hole that rule
 * closes.
 *
 * It re-reads the row rather than trusting what the form posted, so publishing
 * cannot be used to write a value — the only thing this call can change is the
 * status of text somebody already saved and looked at.
 */
export async function publishString(input: {
  key: string;
  locale: string;
  actor: Actor;
}): Promise<AuthoringResult> {
  const [row] = await db
    .select({ status: uiStrings.status })
    .from(uiStrings)
    .where(and(eq(uiStrings.key, input.key), eq(uiStrings.locale, input.locale)))
    .limit(1);

  if (!row) {
    return { error: "There is nothing saved for that string, so there is nothing to publish." };
  }
  if (row.status === "published") return { ok: true };

  await db
    .update(uiStrings)
    .set({ status: "published", updatedBy: input.actor.userId, updatedAt: new Date() })
    .where(and(eq(uiStrings.key, input.key), eq(uiStrings.locale, input.locale)));

  await audit({
    actor: input.actor as never,
    category: "admin",
    action: "string.published",
    resourceType: "ui_string",
    resourceId: `${input.key}:${input.locale}`,
    reason: isSafetyKey(input.key) ? "safety string, published one at a time by a named person" : null,
  });

  await invalidateStrings();
  return { ok: true };
}

/**
 * 🔴 21.5 — clear an override and the shipped wording comes back.
 *
 * A delete, never an empty value. The distinction is the whole ticket: an
 * empty string is a blank button that looks like a rendering bug and is
 * actually somebody's edit, and the database refuses one anyway.
 */
export async function clearString(input: {
  key: string;
  locale: string;
  actor: Actor;
}): Promise<AuthoringResult> {
  await db
    .delete(uiStrings)
    .where(and(eq(uiStrings.key, input.key), eq(uiStrings.locale, input.locale)));

  await audit({
    actor: input.actor as never,
    category: "admin",
    action: "string.cleared",
    resourceType: "ui_string",
    resourceId: `${input.key}:${input.locale}`,
  });

  await invalidateStrings();
  return { ok: true };
}

/* ------------------------------------------------------------ languages -- */

export async function saveLanguage(input: {
  code: string;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  authoringEnabled: boolean;
  publicEnabled: boolean;
  actor: Actor;
}): Promise<AuthoringResult> {
  const code = input.code.trim().toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(code)) {
    return { error: "A language code looks like `es` or `pt-br`." };
  }
  if (!input.name.trim() || !input.nativeName.trim()) {
    return { error: "Name it in English and in its own language, a switcher shows the second." };
  }

  /*
   * 🔴 21.11 / 21.13 — completeness gates the **launch** of a language.
   *
   * Publishing one that is not finished is the failure this whole sprint
   * exists to prevent: a reader offered a language, choosing it, and finding
   * half the product in a language they do not read. Once it is live, 21.12
   * takes over and a new string never takes it down again.
   */
  if (input.publicEnabled) {
    const state = await completeness(code);
    if (state.percent < 100) {
      return {
        error: `${input.name} is ${state.percent}% translated, ${state.missingKeys.length} strings still missing${state.machineDrafts > 0 ? `, and ${state.machineDrafts} machine drafts nobody has approved` : ""}. A language goes live complete or not at all.`,
      };
    }
  }

  await db
    .insert(localesTable)
    .values({
      code,
      name: input.name.trim(),
      nativeName: input.nativeName.trim(),
      direction: input.direction,
      authoringEnabled: input.authoringEnabled,
      publicEnabled: input.publicEnabled,
      updatedBy: input.actor.userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: localesTable.code,
      set: {
        name: input.name.trim(),
        nativeName: input.nativeName.trim(),
        direction: input.direction,
        authoringEnabled: input.authoringEnabled,
        publicEnabled: input.publicEnabled,
        updatedBy: input.actor.userId,
        updatedAt: new Date(),
      },
    });

  await audit({
    actor: input.actor as never,
    category: "admin",
    action: "language.saved",
    resourceType: "locale",
    resourceId: code,
    reason: `authoring=${input.authoringEnabled} public=${input.publicEnabled}`,
  });

  await invalidateStrings();
  return { ok: true };
}

/* --------------------------------------------- 21.16–21.19 · AI drafting -- */

/**
 * Machine-translate what is missing. 21.16, 21.17, 21.19.
 *
 * 🔴 Everything it writes is a **draft**, attributed to the model that wrote
 * it, and counts as missing until a person approves it. There is deliberately
 * no parameter to publish directly: the alternative is a language going live
 * on nobody's judgement, in a product where a mistranslated sentence can be a
 * clinical instruction.
 *
 * Safety strings are translated like any other — they need translating — but
 * `approveDrafts` refuses to publish them in bulk (21.18).
 */
export async function draftTranslations(input: {
  locale: string;
  actor: Actor;
  limit?: number;
}): Promise<AuthoringResult> {
  const state = await completeness(input.locale);
  const targets = state.missingKeys.slice(0, input.limit ?? 200);

  if (targets.length === 0) return { ok: true, count: 0 };

  const { translateStrings } = await import("@/lib/ai/translate");
  const source = Object.fromEntries(targets.map((key) => [key, en[key as MessageKey]]));

  const result = await translateStrings({ locale: input.locale, strings: source });
  if (result.error) return { error: result.error };

  const rows = Object.entries(result.translations ?? {})
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .map(([key, value]) => ({
      key,
      locale: input.locale,
      value: String(value).trim(),
      status: "draft" as const,
      source: "machine" as const,
      model: result.model ?? "unknown",
      updatedBy: input.actor.userId,
      updatedAt: new Date(),
    }));

  if (rows.length === 0) return { error: "The model returned nothing usable." };

  for (const row of rows) {
    await db
      .insert(uiStrings)
      .values(row)
      .onConflictDoUpdate({
        target: [uiStrings.key, uiStrings.locale],
        /*
         * A machine draft never overwrites a **published** string. Somebody
         * has already made a decision about that wording, and a bulk action
         * that quietly replaces reviewed copy is how a reviewed language stops
         * being one.
         */
        set: {
          value: row.value,
          status: "draft",
          source: "machine",
          model: row.model,
          updatedBy: row.updatedBy,
          updatedAt: row.updatedAt,
        },
        setWhere: eq(uiStrings.status, "draft"),
      });
  }

  await audit({
    actor: input.actor as never,
    category: "admin",
    action: "strings.machine_drafted",
    resourceType: "locale",
    resourceId: input.locale,
    reason: `${rows.length} drafts from ${result.model}`,
  });

  log.info("machine translation drafted", { locale: input.locale, count: rows.length });
  await invalidateStrings();
  return { ok: true, count: rows.length };
}

/**
 * A person approves drafts. 21.17, 21.18.
 *
 * 🔴 Safety strings are refused in bulk, always. Crisis copy, consent wording
 * and the recording notice are the three places where being wrong is not a
 * typo, and "approve all" is exactly the action somebody takes at the end of a
 * long afternoon.
 */
export async function approveDrafts(input: {
  locale: string;
  keys: string[];
  actor: Actor;
}): Promise<AuthoringResult> {
  const safety = input.keys.filter(isSafetyKey);

  if (safety.length > 0 && input.keys.length > 1) {
    return {
      error: `${safety.length} of these are crisis, consent or recording strings. Those are approved one at a time, by somebody who has read them.`,
    };
  }

  const approved = await db
    .update(uiStrings)
    .set({ status: "published", updatedBy: input.actor.userId, updatedAt: new Date() })
    .where(
      and(
        eq(uiStrings.locale, input.locale),
        inArray(uiStrings.key, input.keys),
        eq(uiStrings.status, "draft"),
      ),
    )
    .returning({ key: uiStrings.key });

  await audit({
    actor: input.actor as never,
    category: "admin",
    action: "strings.approved",
    resourceType: "locale",
    resourceId: input.locale,
    reason: `${approved.length} strings${safety.length > 0 ? " (safety string, approved individually)" : ""}`,
  });

  await invalidateStrings();
  return { ok: true, count: approved.length };
}

/** Everything an editor needs for one language: the key, both values, state. */
export async function editorRows(locale: string) {
  const keys = shippedKeys();
  const dictionary = (DICTIONARIES as Record<string, Record<string, string>>)[locale] ?? {};

  const rows = await db.select().from(uiStrings).where(eq(uiStrings.locale, locale));
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return keys.map((key) => {
    const override = byKey.get(key);
    return {
      key,
      english: en[key],
      shipped: dictionary[key] ?? null,
      override: override?.value ?? null,
      status: override?.status ?? null,
      source: override?.source ?? null,
      model: override?.model ?? null,
      safety: isSafetyKey(key),
    };
  });
}
