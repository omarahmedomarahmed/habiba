import "server-only";

import { log, safeErrorMessage } from "@/lib/logger";

import { FHIR_ACCEPT } from "./smart";

/**
 * 🔴 43.2 / 43.4 — THE FHIR R4 CLIENT, AND IT CANNOT WRITE TO OUR DATABASE.
 *
 * ## 🔴 THERE IS NO `db` IMPORT IN THIS FILE, AND THAT IS THE ENFORCEMENT
 *
 * 43.4's third rule is that anything we read from a hospital's chart is used in the request that
 * needed it and never stored. Every other way of saying that is a promise; this is a module with
 * no database handle, no schema import and no `controlDb`, so a function here that wanted to
 * persist a problem list would have to add an import somebody reads in a diff.
 *
 * `verify:sprint43` asserts the absence, with a control that the module still fetches.
 *
 * ## 🔴 AND IT RETURNS NARROWED SHAPES, NOT RESOURCES
 *
 * `readPatientName` returns a string. Not a `Patient`, not `unknown`, not the parsed JSON. The
 * reason is the same one `whoMayRead` taught in sprint 55: a function that returns the whole
 * object invites a caller to keep the parts nobody meant them to have, and the caller is usually
 * right that it was convenient. A narrow return type is a decision the compiler enforces at every
 * call site instead of once here.
 *
 * So the only shapes that leave this file are a display name and a booking-safe identifier. The
 * rest of the `Patient` resource is parsed, used, and dropped when the function returns.
 */

const TIMEOUT_MS = 15_000;

export type FhirContext = {
  fhirBaseUrl: string;
  accessToken: string;
};

type FhirResult<T> = { data: T } | { error: string; status?: number };

/**
 * One request, with the pinned version in the Accept header.
 *
 * 🔴 The path is checked for traversal and for absoluteness. A FHIR path is assembled from a
 * resource type and an id, and an id is a string a hospital gave us: `../../metadata` or a full
 * `https://` URL in the id position would point this request somewhere else with our bearer token
 * attached. So a path with a scheme or a `..` segment is refused before the fetch.
 */
async function request<T>(ctx: FhirContext, path: string): Promise<FhirResult<T>> {
  if (/^[a-z]+:\/\//i.test(path) || path.split("/").includes("..")) {
    return { error: "That is not a path on this server." };
  }

  const base = ctx.fhirBaseUrl.replace(/\/+$/, "");

  try {
    const response = await fetch(`${base}/${path.replace(/^\/+/, "")}`, {
      headers: {
        authorization: `Bearer ${ctx.accessToken}`,
        accept: FHIR_ACCEPT,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      /*
       * 🔴 The body is NOT passed through here, unlike the token endpoint's error.
       *
       * A FHIR `OperationOutcome` on a failed read can quote the resource it refused, which means
       * a 403 about a patient can contain that patient's details. The status is what a caller
       * needs; the diagnostics stay in the hospital's own logs.
       */
      return { error: `That request was refused (${response.status}).`, status: response.status };
    }

    return { data: (await response.json()) as T };
  } catch (error) {
    log.warn("fhir request failed", { reason: safeErrorMessage(error) });
    return { error: "That hospital's FHIR server could not be reached." };
  }
}

/**
 * 🔴 43.4's ONE CARVED EXCEPTION: a display name, and nothing else from the resource.
 *
 * Returns a string, so there is no `Patient` object for a caller to keep. A schedule row, a note
 * header and a consent prompt need a name on them or they are a wrong-patient risk; nothing else
 * on the resource clears that bar, and everything else on it is `THEIRS_NEVER_OURS`.
 *
 * FHIR `HumanName` is an array with `use` codes, so this prefers the official one and falls back
 * to the first — a patient with a preferred name and a legal name has both, and the chart's own
 * choice is the one a clinician will recognise.
 */
export async function readPatientName(
  ctx: FhirContext,
  fhirPatientId: string,
): Promise<{ name?: string; error?: string }> {
  const result = await request<{
    name?: { use?: string; text?: string; given?: string[]; family?: string }[];
  }>(ctx, `Patient/${encodeURIComponent(fhirPatientId)}`);

  if ("error" in result) return { error: result.error };

  const names = result.data.name ?? [];
  const chosen = names.find((n) => n.use === "official") ?? names[0];
  if (!chosen) return { error: "That chart has no name on it." };

  const assembled =
    chosen.text?.trim() ||
    [chosen.given?.join(" ")?.trim(), chosen.family?.trim()].filter(Boolean).join(" ");

  if (!assembled) return { error: "That chart has no name on it." };

  /*
   * 🔴 Only the name leaves. `result.data` also carries birthDate, identifier, address, telecom,
   * maritalStatus, contact and communication on a real tenant, and every one of them is on
   * `THEIRS_NEVER_OURS`. They are in memory for the length of this function and in no row ever.
   */
  return { name: assembled.slice(0, 200) };
}

/**
 * 🔴 43.3 — FILE A NOTE AS A `DocumentReference`.
 *
 * The only WRITE in this file, matching the only write scope we request. A `Condition.write` or an
 * `Observation.write` would put a diagnosis or a measurement in somebody's chart, and §7's first
 * hard rule is that content in a chart needs a named human who approved that exact text. A note
 * has one; a structured resource we synthesised from a transcript does not.
 *
 * ## 🔴 US Core 6.1.0's REQUIRED FIELDS, and why each is what it is
 *
 * `status: current`, `type` as a LOINC code, `subject`, `date`, `author`, `content.attachment`.
 * The type is `11488-4` (Consultation note) rather than a psychiatry-specific code, because a
 * code a tenant's terminology service does not recognise is a filing that fails at the hospital
 * rather than here, and Consultation note is in every US Core implementation guide.
 *
 * `author` is the CLINICIAN's FHIR practitioner reference when the launch gave us one, and
 * omitted otherwise. It is never us: a `DocumentReference` authored by an application is a note
 * in a chart with no human name on it, which is the exact thing we refuse to accept from a
 * partner's server in sprint 55 and must not do ourselves.
 */
export async function fileDocumentReference(
  ctx: FhirContext,
  input: {
    fhirPatientId: string;
    fhirEncounterId: string | null;
    /** The approved note's text. Plain, because a chart is read by people in a hurry. */
    text: string;
    /** When the clinician approved it, not when we sent it. */
    approvedAt: Date;
    /** Their practitioner reference, when the launch supplied one. Never us. */
    authorReference: string | null;
    title: string;
  },
): Promise<{ documentReferenceId?: string; error?: string }> {
  const base = ctx.fhirBaseUrl.replace(/\/+$/, "");

  const resource: Record<string, unknown> = {
    resourceType: "DocumentReference",
    status: "current",
    type: {
      coding: [
        { system: "http://loinc.org", code: "11488-4", display: "Consultation note" },
      ],
    },
    subject: { reference: `Patient/${input.fhirPatientId}` },
    date: input.approvedAt.toISOString(),
    description: input.title.slice(0, 200),
    content: [
      {
        attachment: {
          contentType: "text/plain",
          /* Base64, per the FHIR `Attachment.data` type. */
          data: Buffer.from(input.text, "utf8").toString("base64"),
          title: input.title.slice(0, 200),
          creation: input.approvedAt.toISOString(),
        },
      },
    ],
  };

  /* 🔴 The clinician, or nobody. Never this application. */
  if (input.authorReference) resource.author = [{ reference: input.authorReference }];

  /* Attached to the encounter the clinician launched from, so it lands in the right visit. */
  if (input.fhirEncounterId) {
    resource.context = { encounter: [{ reference: `Encounter/${input.fhirEncounterId}` }] };
  }

  try {
    const response = await fetch(`${base}/DocumentReference`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ctx.accessToken}`,
        "content-type": "application/fhir+json",
        accept: FHIR_ACCEPT,
      },
      body: JSON.stringify(resource),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return { error: `That hospital refused the note (${response.status}).` };
    }

    /*
     * 🔴 The id can arrive in the body OR only in the Location header, and vendors differ.
     *
     * A writeback with no id is a note we believe filed and cannot look up, which
     * `ehr_writebacks_filed_names_document` refuses to record as filed. So both are read, and a
     * 201 with neither is reported as a failure rather than optimistically marked done.
     */
    const body = (await response.json().catch(() => ({}))) as { id?: unknown };
    const fromBody = typeof body.id === "string" ? body.id : null;
    const fromHeader = response.headers.get("location")?.match(/DocumentReference\/([^/?]+)/)?.[1];

    const id = fromBody ?? fromHeader ?? null;
    if (!id) {
      return {
        error:
          "That hospital accepted the note but did not say where it put it, so we cannot record that it landed.",
      };
    }

    return { documentReferenceId: id };
  } catch (error) {
    log.warn("document reference filing failed", { reason: safeErrorMessage(error) });
    return { error: "That hospital's FHIR server could not be reached." };
  }
}

/**
 * 🔴 THE ABSENCE, STATED SO A VERIFIER CAN FIND IT.
 *
 * Nothing in this file imports a database handle, a schema table or `controlDb`, and the two
 * functions that read return a string and an id rather than a resource. 43.4's third rule — read
 * through, never store — is a property of this module's import list, which is invisible to a
 * reader unless something says so out loud.
 */
export const READ_THROUGH_IS_NEVER_STORED = true;
