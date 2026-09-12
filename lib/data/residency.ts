import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { crossBorderConsents, people } from "@/lib/db/schema";
import {
  crossesBorder,
  DEFAULT_REGION,
  isRegion,
  regionLabel,
  regionStatus,
  type Region,
} from "@/lib/db/region";

/**
 * Cross-border consent, and the record of processing. PLAN.md 30.3, C118.
 *
 * ## 🔴 Why the consent is asked and not assumed
 *
 * Egyptian counsel says Egyptian data must sit in Egypt, and today it does
 * not: `DATABASE_URL_EG` is unset and `dbFor("eg")` returns the US instance.
 * That is the ruling — build the seam, point Egypt at the US instance, ship —
 * and it is only defensible because the people it affects are **told**, in
 * their own language, and agree.
 *
 * A product that routed on a region it did not have, and said nothing, would
 * have a type system claiming residency and a database contradicting it. That
 * is worse than having no seam at all, because it would read as compliance.
 *
 * ## The wording is stored, not referenced
 *
 * The row holds the sentences somebody actually read. A version number
 * pointing at editable text proves nothing a year later, and the whole purpose
 * of a record of processing is to survive the year.
 *
 * ## This table is control plane
 *
 * Deliberately. It is the record of a transfer between regions, so it cannot
 * live inside one of them: the row about Egyptian data being served from
 * Virginia would otherwise be in Virginia, which is the thing it is recording.
 */

/**
 * The wording, in both languages, generated from the live fact rather than
 * written as copy.
 *
 * 🔴 It names the actual serving region, read at call time. A consent screen
 * with the country hard-coded would keep saying "United States" the day after
 * Cairo went live, and somebody would agree to a transfer that was no longer
 * happening.
 */
export function consentWording(home: Region, locale: string): string {
  const serving = regionStatus(home).servedFrom;
  /* C150 — the locale is a parameter, all the way down to the country name. */
  const here = regionLabel(home, locale);
  const there = regionLabel(serving, locale);

  if (locale === "ar") {
    return (
      `سجلّك الصحي يخصّ ${here}، ولا توجد لدينا اليوم قاعدة بيانات داخل ${here}، ` +
      `فهو محفوظ على خوادم في ${there}. هذا يعني أن جلساتك وملاحظاتك تُخزَّن خارج بلدك. ` +
      `نطلب موافقتك على ذلك صراحةً، ويمكنك سحبها في أي وقت، وسننقل بياناتك إلى ${here} ` +
      `حالما تتوفر لدينا قاعدة بيانات هناك ودون أن نسألك مرة أخرى.`
    );
  }

  return (
    `Your record belongs to ${here}. We do not yet have a database inside ${here}, ` +
    `so it is held on servers in ${there}. That means your sessions and your notes are ` +
    `stored outside your own country. We are asking you to agree to that explicitly. You ` +
    `can withdraw at any time, and we will move your data to ${here} as soon as we have a ` +
    `database there, without asking you again.`
  );
}

export type ResidencyState = {
  homeRegion: Region;
  servingRegion: Region;
  /** True when the record is not in the country it belongs to. */
  crosses: boolean;
  /** The consent on file for the CURRENT crossing, if there is one. */
  agreedAt: Date | null;
  wording: string | null;
};

export async function residencyFor(personId: string, locale: string): Promise<ResidencyState> {
  const [person] = await controlDb
    .select({ region: people.region })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  const homeRegion = isRegion(person?.region) ? person.region : DEFAULT_REGION;
  const servingRegion = regionStatus(homeRegion).servedFrom;
  const crosses = crossesBorder(homeRegion);

  if (!crosses) {
    return { homeRegion, servingRegion, crosses, agreedAt: null, wording: null };
  }

  /*
   * 🔴 Matched on the CURRENT pair, not on "has this person ever agreed".
   *
   * Agreeing to be served from the United States is not agreeing to be served
   * from anywhere. If the serving region ever changes, the old row stops
   * satisfying this and the person is asked again, which is what a consent to
   * a specific transfer means.
   */
  const [agreed] = await controlDb
    .select({ agreedAt: crossBorderConsents.agreedAt })
    .from(crossBorderConsents)
    .where(
      and(
        eq(crossBorderConsents.personId, personId),
        eq(crossBorderConsents.homeRegion, homeRegion),
        eq(crossBorderConsents.servingRegion, servingRegion),
        isNull(crossBorderConsents.withdrawnAt),
      ),
    )
    .orderBy(desc(crossBorderConsents.agreedAt))
    .limit(1);

  return {
    homeRegion,
    servingRegion,
    crosses,
    agreedAt: agreed?.agreedAt ?? null,
    wording: consentWording(homeRegion, locale),
  };
}

export type ConsentResult = { ok: true } | { ok: false; error: string };

/**
 * Record the agreement.
 *
 * 🔴 The database refuses a row whose two regions are the same
 * (`cross_border_consents_actually_crosses`), so a screen cannot manufacture
 * agreement to a transfer that is not happening. That matters because the
 * obvious bug is a page that records consent on every load: it would fill the
 * record of processing with agreements nobody was asked for, and the table
 * whose entire purpose is proving what was asked would be the one lying.
 */
export async function recordCrossBorderConsent(input: {
  personId: string;
  locale: string;
}): Promise<ConsentResult> {
  const state = await residencyFor(input.personId, input.locale);

  if (!state.crosses) {
    return {
      ok: false,
      error: "Nothing is crossing a border for this record, so there is nothing to agree to.",
    };
  }

  await controlDb.insert(crossBorderConsents).values({
    personId: input.personId,
    homeRegion: state.homeRegion,
    servingRegion: state.servingRegion,
    wording: state.wording!,
    locale: input.locale,
  });

  return { ok: true };
}

/** Withdrawing. Never deletes the row: a record of processing is a record. */
export async function withdrawCrossBorderConsent(personId: string): Promise<void> {
  await controlDb
    .update(crossBorderConsents)
    .set({ withdrawnAt: new Date() })
    .where(
      and(eq(crossBorderConsents.personId, personId), isNull(crossBorderConsents.withdrawnAt)),
    );
}
