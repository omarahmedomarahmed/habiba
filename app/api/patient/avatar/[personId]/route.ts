import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { patients, people } from "@/lib/db/schema";
import { getActor } from "@/lib/auth/session";
import { optionalPatient } from "@/lib/patient-auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A patient's own picture. PLAN.md 25.7, C115.
 *
 * ## 🔴 Why this route exists at all
 *
 * The storage URL would have worked. It carries 24 random bytes and nobody can
 * guess it, which is how every clinician credential in this product is
 * protected. C115 rules that a patient's photo does not get that treatment:
 * "stored private, served through an authenticated route like documents, never
 * a public object". The difference is that a credential URL is only ever
 * handed to the person it belongs to and to an admin, while a patient photo is
 * rendered into a clinician's caseload list. An unguessable URL in a page is
 * only unguessable until the page is screenshotted, forwarded or cached by
 * something, and this is a photograph of somebody in therapy.
 *
 * So the URL is `/api/patient/avatar/:personId`, which carries no secret at
 * all, and the access control is a question asked on every request:
 *
 *   - the patient themselves, or
 *   - a clinician with a live patient record for that person in their own
 *     organisation, or
 *   - a super admin, who has to be able to look at what they are removing.
 *
 * Anyone else gets a 404 rather than a 403, because "this person exists and
 * has a photo" is itself something we do not owe a stranger.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;

  const [row] = await db
    .select({ avatarUrl: people.avatarUrl })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  if (!row?.avatarUrl) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!(await mayRead(personId))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  /*
   * Fetched and re-served rather than redirected.
   *
   * A 302 to the storage URL would hand the caller the unguessable path, and
   * from that moment the photo is a public object again, which is the exact
   * thing C115 refuses. The proxy costs a hop on an image that is 2 MB at
   * worst and 44 pixels wide in practice.
   */
  const upstream = row.avatarUrl.startsWith("/")
    ? null
    : await fetch(row.avatarUrl, { cache: "no-store" }).catch(() => null);

  if (!upstream?.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return new NextResponse(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      /*
       * Private, and short. A shared cache must never hold this, and the
       * browser may hold it only long enough that scrolling a list does not
       * refetch every face.
       */
      "cache-control": "private, max-age=300",
    },
  });
}

async function mayRead(personId: string): Promise<boolean> {
  const patient = await optionalPatient();
  if (patient?.personId === personId) return true;

  const actor = await getActor();
  if (!actor) return false;
  if (actor.role === "super_admin") return true;

  const [record] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.personId, personId),
        eq(patients.organizationId, actor.organizationId),
        eq(patients.therapistId, actor.userId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);

  return Boolean(record);
}
