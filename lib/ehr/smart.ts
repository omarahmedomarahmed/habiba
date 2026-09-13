import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";

import { PINNED, REQUESTED_SCOPES, scopesAreMinimal } from "./vendors";

/**
 * 🔴 43.2 — THE SMART ON FHIR OAUTH CLIENT. WE ARE THE CLIENT AND NEVER THE SERVER.
 *
 * ## 🔴 THE ENDPOINTS ARE DISCOVERED, NOT CONFIGURED
 *
 * SMART's whole conformance story is `/.well-known/smart-configuration` at the hospital's own
 * FHIR base. Two Epic hospitals share no authorise URL, no token URL and no issuer, which is why
 * `ehr_connections` carries a base URL per row and `lib/ehr/vendors.ts` carries no URLs at all.
 *
 * A configured endpoint would work for exactly one customer and look like it worked for all of
 * them, which is the kind of integration that passes a demo and fails the second sale.
 *
 * ## 🔴 PKCE ALWAYS, EVEN WHEN A SECRET IS AVAILABLE
 *
 * The authorisation code comes back through a browser redirect, which means it travels through
 * the clinician's address bar, their history, and any referrer a hospital's portal leaks. PKCE is
 * what makes a stolen code useless without the verifier that never left this server.
 *
 * We do it even in the confidential profile, where a secret would technically do the job, because
 * the two protections cover different thefts: a secret stops a stranger redeeming a code they
 * captured, and PKCE stops the code being redeemable at all by anybody who did not start the
 * flow. There is no reason to choose.
 *
 * ## 🔴 EVERY DISCOVERED URL IS RE-CHECKED FOR https AND FOR ORIGIN
 *
 * Discovery output is a document a hospital serves, so it is data from outside. A token URL that
 * came back pointing somewhere else is where our client credentials and a patient's chart would
 * be sent. `ehr_connections_https` refuses an http base URL at the database; this refuses an
 * authorise or token endpoint that leaves the base URL's own origin.
 */

const TIMEOUT_MS = 10_000;

export type SmartConfiguration = {
  authorizeUrl: string;
  tokenUrl: string;
  issuer: string;
  /** What the hospital says it supports, for the sentence a failure needs. */
  supportedScopes: string[];
};

/**
 * 🔴 Discover a hospital's endpoints, and refuse the ones that do not belong to it.
 *
 * `fhirBaseUrl` is ours (an operator typed it, and the database CHECK requires https). Everything
 * this returns came from that server, so every URL is checked back against the base URL's origin:
 * a hospital that serves a token endpoint on somebody else's host is either misconfigured or
 * compromised, and in both cases we must not post a credential to it.
 */
export async function discover(
  fhirBaseUrl: string,
): Promise<{ config?: SmartConfiguration; error?: string }> {
  const base = fhirBaseUrl.replace(/\/+$/, "");
  if (!base.startsWith("https://")) return { error: "That FHIR base URL is not https." };

  let baseOrigin: string;
  try {
    baseOrigin = new URL(base).origin;
  } catch {
    return { error: "That FHIR base URL is not a URL." };
  }

  let body: unknown;
  try {
    const response = await fetch(`${base}/.well-known/smart-configuration`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        error: `That server does not publish a SMART configuration (${response.status}). A hospital's integration team can confirm the FHIR base URL.`,
      };
    }
    body = await response.json();
  } catch (error) {
    log.warn("smart discovery failed", { reason: safeErrorMessage(error) });
    return { error: "That server could not be reached." };
  }

  const doc = body as Record<string, unknown>;
  const authorizeUrl = typeof doc.authorization_endpoint === "string" ? doc.authorization_endpoint : "";
  const tokenUrl = typeof doc.token_endpoint === "string" ? doc.token_endpoint : "";
  const issuer = typeof doc.issuer === "string" ? doc.issuer : base;

  if (!authorizeUrl || !tokenUrl) {
    return { error: "That SMART configuration names no authorise or token endpoint." };
  }

  /*
   * 🔴 SAME ORIGIN AS THE BASE URL. Both of them, checked, before either is stored.
   *
   * This is the one check in this file that defends against the server we are talking to rather
   * than against a stranger. It is cheap and it is the difference between "a hospital configured
   * something oddly" and "our client secret was posted to an address in a JSON document".
   */
  for (const [what, url] of [
    ["authorise", authorizeUrl],
    ["token", tokenUrl],
  ] as const) {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return { error: `That server's ${what} endpoint is not a URL.` };
    }
    if (!url.startsWith("https://")) return { error: `That server's ${what} endpoint is not https.` };
    if (origin !== baseOrigin) {
      return {
        error: `That server's ${what} endpoint is on a different host from its FHIR base. We will not send a credential there.`,
      };
    }
  }

  const supportedScopes =
    typeof doc.scopes_supported === "object" && Array.isArray(doc.scopes_supported)
      ? doc.scopes_supported.filter((s): s is string => typeof s === "string")
      : [];

  return { config: { authorizeUrl, tokenUrl, issuer, supportedScopes } };
}

export type PkcePair = { verifier: string; challenge: string };

/** PKCE S256. The verifier never leaves this server; the challenge is all the browser carries. */
export function pkce(): PkcePair {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Where our redirect comes back to. Built from `env.appUrl`, never from a request's Host. */
export function redirectUri(): string {
  return `${env.appUrl}/api/ehr/callback`;
}

/**
 * Build the authorise URL a clinician's browser is sent to.
 *
 * 🔴 `aud` is the FHIR base URL, and it is not optional in SMART. It is what stops an
 * authorisation issued for one hospital being replayed against another: the token the hospital
 * mints is bound to the audience it was asked for.
 */
export function authorizeUrl(input: {
  config: SmartConfiguration;
  fhirBaseUrl: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(input.config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.ehrClientId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", REQUESTED_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("aud", input.fhirBaseUrl.replace(/\/+$/, ""));
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export type TokenGrant = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  /** What they actually granted, which is often narrower than what we asked for. */
  scopes: string[];
  /** The launch context, when the hospital supplied one. */
  fhirPatientId: string | null;
  fhirEncounterId: string | null;
};

/**
 * Exchange the code, or refresh. One function, because the two requests differ by two fields and
 * agree on every check afterwards.
 *
 * 🔴 THE GRANTED SCOPES ARE RE-CHECKED AGAINST `scopesAreMinimal`.
 *
 * We ask for a short list, and a hospital may hand back more than we asked for: some tenants
 * grant what their administrator configured rather than what the request said. A connection that
 * quietly holds `patient/*.read` is a shadow chart waiting to be written, so it is refused at the
 * exchange rather than accepted and merely not used. Not using a permission is a decision the
 * next author gets to revisit.
 */
async function exchange(
  tokenUrl: string,
  body: URLSearchParams,
): Promise<{ grant?: TokenGrant; error?: string }> {
  body.set("client_id", env.ehrClientId);

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };

  /*
   * The confidential profile. Basic auth rather than a body field, because that is what the
   * spec prefers and what every vendor implements consistently.
   */
  if (env.ehrClientSecret) {
    const basic = Buffer.from(`${env.ehrClientId}:${env.ehrClientSecret}`).toString("base64");
    headers.authorization = `Basic ${basic}`;
  }

  let payload: Record<string, unknown>;
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      /*
       * Their message, passed through, because the person reading it is an operator on a call
       * with a hospital's integration team and "invalid_client" is the whole answer they need.
       */
      const reason =
        typeof payload.error_description === "string"
          ? payload.error_description
          : typeof payload.error === "string"
            ? payload.error
            : String(response.status);
      return { error: `That hospital refused the connection: ${reason}` };
    }
  } catch (error) {
    log.warn("smart token exchange failed", { reason: safeErrorMessage(error) });
    return { error: "That hospital's token endpoint could not be reached." };
  }

  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!accessToken) return { error: "That hospital returned no access token." };

  const granted =
    typeof payload.scope === "string" ? payload.scope.split(/\s+/).filter(Boolean) : [];

  if (granted.length > 0 && !scopesAreMinimal(granted)) {
    /*
     * 🔴 REFUSED, not trimmed. We cannot narrow a token a hospital already minted, so accepting
     * it would mean holding a credential that can read a whole chart and promising not to. The
     * refusal is a sentence an operator can take back to the hospital.
     */
    return {
      error:
        "That hospital granted broader access than we ask for, including reading records we have no business holding. We will not hold a credential like that. Ask their integration team to grant only the scopes in our registration.",
    };
  }

  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : null;

  return {
    grant: {
      accessToken,
      refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : null,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      scopes: granted,
      /* SMART returns the launch context alongside the token, in its own top-level fields. */
      fhirPatientId: typeof payload.patient === "string" ? payload.patient : null,
      fhirEncounterId: typeof payload.encounter === "string" ? payload.encounter : null,
    },
  };
}

export async function redeemCode(input: {
  tokenUrl: string;
  code: string;
  verifier: string;
}): Promise<{ grant?: TokenGrant; error?: string }> {
  return exchange(
    input.tokenUrl,
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: redirectUri(),
      code_verifier: input.verifier,
    }),
  );
}

export async function refresh(input: {
  tokenUrl: string;
  refreshToken: string;
}): Promise<{ grant?: TokenGrant; error?: string }> {
  return exchange(
    input.tokenUrl,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: input.refreshToken }),
  );
}

/** The pinned versions, for the header every FHIR request sends and the screen an operator reads. */
export const FHIR_ACCEPT = `application/fhir+json; fhirVersion=${PINNED.fhir}`;
