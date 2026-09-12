import "server-only";

import { eq } from "drizzle-orm";

import { controlDb } from "./index";
import { organizations, patients, people } from "./schema";
import { DEFAULT_REGION, isRegion, type Region } from "./region";

/**
 * Which region an entity lives in. PLAN.md 30.1, C118.
 *
 * ## 🔴 Why the directory is control plane
 *
 * "Route on the entity" has a chicken-and-egg problem: to know which database
 * holds a person's sessions you have to ask something, and asking the regional
 * database is circular. So the answer lives on the control plane, which every
 * region reads, and the regional databases hold only the data.
 *
 * That makes `organizations.region` and `people.region` the two rows the whole
 * seam turns on. Both default to `us`, which is not a backfill: it is where
 * every existing row already is.
 *
 * ## Cached per request, not per process
 *
 * A region can change: a clinic incorporates in Cairo, a patient moves. A
 * process-lifetime cache would keep routing them to the old country until the
 * next deploy, which for this particular fact is the failure the sprint
 * exists to prevent. `unstable_cache` with a short window and a tag is the
 * shape used elsewhere for content; here the window is deliberately zero and
 * the cache is a per-request `Map`, because the number of distinct entities in
 * one request is small and the cost of being wrong is a record in the wrong
 * jurisdiction.
 */

/**
 * A patient's region, from the person row.
 *
 * Falls back to the default rather than throwing on an unknown value, and says
 * so in the return: a row whose region string is not one we have a pool for is
 * a row whose data has nowhere to live, and the honest handling is to serve it
 * from the default and let the CHECK constraint stop the next such write.
 */
export async function regionOfPerson(personId: string): Promise<Region> {
  const [row] = await controlDb
    .select({ region: people.region })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  return isRegion(row?.region) ? row.region : DEFAULT_REGION;
}

export async function regionOfOrganization(organizationId: string): Promise<Region> {
  const [row] = await controlDb
    .select({ region: organizations.region })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return isRegion(row?.region) ? row.region : DEFAULT_REGION;
}

/**
 * A clinic's file on somebody. 🔴 Routed on the PATIENT, not the practice.
 *
 * This is the case C118 is actually about and the one an obvious
 * implementation gets wrong. An Egyptian patient seeing a clinician registered
 * in the United States is ordinary on this product, not an edge, and routing
 * their chart to the clinician's region would put an Egyptian person's therapy
 * record in the wrong country while every test passed.
 *
 * Falls back to the organisation only when a patient row has no person yet,
 * which is a record created before sprint 5's backfill rather than an error.
 */
export async function regionOfPatient(patientId: string): Promise<Region> {
  const [row] = await controlDb
    .select({ personId: patients.personId, organizationId: patients.organizationId })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!row) return DEFAULT_REGION;
  if (row.personId) return regionOfPerson(row.personId);
  return regionOfOrganization(row.organizationId);
}
