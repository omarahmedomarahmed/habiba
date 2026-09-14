import { NextResponse } from "next/server";

import { askPartnerCopilot } from "@/lib/partner/copilot";
import { clinicianEnabled } from "@/lib/partner/platform";
import { mayRun } from "@/lib/partner/usage";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 68.7 / 68.12 / 68.13 — POST /api/partner/v1/copilot
 *
 * *Copilot chat about a patient, with the citations that resolve.*
 *
 * ## 🔴 THE CLINICIAN HAS TO HAVE TURNED IT ON, AND THAT IS 68.13 RATHER THAN A GATE
 *
 * > *When a clinician enables it they get the copilot with their own patient list,
 * > and a button per patient to share the record for insight. Sharing is an act with
 * > a name, not a default.*
 *
 * A general telehealth platform has GPs and physios on it. An integration that
 * enabled the copilot for every clinician on the platform would be putting a
 * therapy-shaped tool in front of people who did not ask for one, and the opt-in is
 * how the right people find it. `clinician` is required for exactly this reason.
 *
 * ## 🔴 AND THE LIMIT IS CHECKED HERE TOO, PER 68.17
 *
 * *At the limit, THEIR product keeps working and OURS stops. No copilot in the room.*
 * The refusal carries a sentence rather than an empty body, because 68.18 says the
 * stop must be explicit on their therapist's screen: a copilot that vanishes without
 * a word is read as our outage, and their therapist is mid-session.
 */
export async function POST(request: Request) {
  const guard = await withKey(request, "copilot:chat");
  if ("response" in guard) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Send JSON.", 400);
  }

  const subject = body.subject;
  const clinician = body.clinician;
  const question = body.question;

  if (
    typeof subject !== "string" ||
    typeof clinician !== "string" ||
    typeof question !== "string"
  ) {
    return fail("Send subject, clinician and question.", 400);
  }

  const enabled = await clinicianEnabled({
    partnerId: guard.key.partnerId,
    externalClinicianRef: clinician,
  });

  if (!enabled) {
    return fail(
      "That clinician has not turned the copilot on. It is an opt-in on their own profile, because a therapy copilot in front of somebody who did not ask for one is not a feature.",
      403,
    );
  }

  const permitted = await mayRun({
    partnerId: guard.key.partnerId,
    environment: guard.key.environment,
  });

  if (!permitted.allowed) return fail(permitted.reason, 409);

  const answer = await askPartnerCopilot({
    partnerId: guard.key.partnerId,
    externalSubjectRef: subject,
    question,
  });

  return NextResponse.json({
    answer: answer.answer,
    /* 🔴 Their session references, so a citation resolves in their interface. */
    citations: answer.citations,
  });
}

/**
 * 🔴 68.12 / 68.13 — PUT /api/partner/v1/copilot
 *
 * A clinician turns it on or off. The label their platform shows beside this is the
 * ruling's own words and it is theirs to render: *AI notes, transcripts and a copilot
 * that prepares you for sessions, for therapists.*
 *
 * There is no profession here and no check that reads one. We do not decide who is a
 * therapist on somebody else's platform, and a filter that tried would be wrong about
 * a counsellor, a psychologist and half the titles in use outside the two countries
 * we happen to have thought about.
 */
export async function PUT(request: Request) {
  const guard = await withKey(request, "copilot:chat");
  if ("response" in guard) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Send JSON.", 400);
  }

  const clinician = body.clinician;
  const enabled = body.enabled;

  if (typeof clinician !== "string" || typeof enabled !== "boolean") {
    return fail("Send clinician and enabled.", 400);
  }

  const { enableClinician } = await import("@/lib/partner/platform");
  await enableClinician({
    partnerId: guard.key.partnerId,
    externalClinicianRef: clinician,
    enabled,
  });

  return NextResponse.json({ clinician, enabled });
}
