import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { patientAccounts, people, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { fullName } from "@/lib/utils";

/**
 * 🔴 K18: A CLINICIAN SET SOMETHING, AND THE PATIENT IS TOLD.
 *
 * Setting a step or sending a questionnaire as homework wrote a row and told
 * nobody, so a patient learned about it only by opening the right screen on
 * the right day. Homework is the surface that reaches OUT to a patient; the
 * reaching out was the part missing.
 *
 * Only to a person with a live account: an unclaimed person has no app to open
 * and a message about "your app" would be the product addressing somebody who
 * never signed up. No clinical content: the clinician's name and a link, never
 * the step's words or the questionnaire's name (PHQ-9 on a lock screen is a
 * diagnosis on a lock screen).
 *
 * Best effort. A failed message never fails the assignment, which is already
 * saved and visible in the app.
 */
export async function tellPatientOfWork(input: {
  personId: string;
  therapistUserId: string;
  what: "homework" | "assessment";
}): Promise<void> {
  try {
    const [account] = await db
      .select({
        email: patientAccounts.email,
        phone: patientAccounts.phone,
        personPhone: people.phone,
        timezone: patientAccounts.timezone,
      })
      .from(patientAccounts)
      .innerJoin(people, eq(people.id, patientAccounts.personId))
      .where(and(eq(patientAccounts.personId, input.personId), isNull(patientAccounts.deletedAt)))
      .limit(1);
    if (!account) return;

    const [clinician] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, input.therapistUserId))
      .limit(1);

    const { wordsFor } = await import("@/lib/i18n/message-words");
    const { t, locale } = await wordsFor({ personId: input.personId });
    const who = fullName(clinician?.firstName, clinician?.lastName, "") || t("pmsg.aTherapist");

    const homework = input.what === "homework";
    const { notify } = await import("@/lib/notify");
    await notify(
      {
        personId: input.personId,
        email: account.email,
        phone: account.phone ?? account.personPhone,
        timezone: account.timezone,
        locale,
      },
      {
        notice: homework
          ? { kind: "homework_set", key: "pnotice.homeworkSet" }
          : { kind: "assessment_sent", key: "pnotice.assessmentSent" },
        kind: homework ? "homework.set" : "assessment.sent",
        subject: t(homework ? "pmsg.homework.subject" : "pmsg.assessment.subject"),
        body: t(homework ? "pmsg.homework.body" : "pmsg.assessment.body", { name: who }),
        link: {
          label: t(homework ? "pmsg.homework.link" : "pmsg.assessment.link"),
          url: `${env.appUrl}${homework ? "/patient/homework" : "/patient/assessments"}`,
        },
        variables: [who],
      },
    );
  } catch (error) {
    log.warn("could not tell a patient about work set for them", {
      person: ref(input.personId),
      reason: String(error),
    });
  }
}
