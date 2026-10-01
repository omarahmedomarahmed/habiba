/**
 * DD-2: claims a public page may not make, because they are false today.
 *
 * The CMS is authored-wins: a `content_pages` row overrides the copy in
 * `defaults.ts`, so a row written before a correction keeps a false sentence
 * live after the code was fixed. Due diligence found seven on the live site.
 *
 * This list is checked in four places:
 *   - `verify:claims-defaults` over the shipped defaults (static, in CI);
 *   - `verify:cms-claims` over the database rows (run on production);
 *   - `getPublicPage`, which serves the code default instead of a row that
 *     carries one, and records it on the errors board;
 *   - `savePage`, which refuses to store one.
 *
 * Each rule names a claim and why it is false. When the fact changes (a BAA is
 * signed, an entity is registered, a region opens), the rule is deleted in the
 * same change that corrects the copy.
 */

export type ClaimRule = { id: string; why: string; patterns: RegExp[] };

export const FORBIDDEN_CLAIMS: ClaimRule[] = [
  {
    id: "baa-included",
    why: "No business associate agreement is signed with anyone (see /hipaa).",
    patterns: [
      /\b(?:BAA|business associate agreement)s?\b[^?.]{0,60}\?\s*["']?\s*Yes\b/i,
      /(?<!\bno\s)(?<!\bNo\s)\b(?:a\s+)?(?:BAA|business associate agreement)s?\s+(?:is|are)\s+(?:included|in place|signed)\b/,
      /\b(?:BAA|business associate agreement)s?\s+(?:included\b(?!\s*\?)|on every plan\b)/i,
      /\bcovered by (?:a|an|our|the)\s+(?:signed\s+)?(?:BAA|business associate agreement)\b/i,
      /\b(?:we|24Therapy)\s+(?:sign|signs|will sign|offer|offers|provide|provides|include|includes)\s+(?:a\s+|an\s+)?(?:BAA|business associate agreement)\b/i,
    ],
  },
  {
    id: "region-on-request",
    why: "No region outside the United States exists (lib/db/region.ts).",
    patterns: [
      /\bregion\s+(?:inside|within|in)\s+your\s+(?:own\s+)?(?:jurisdiction|country)\b/i,
      /\b(?:region|data residency|in-country hosting)\b[^.]{0,60}\b(?:available|offered)\s+on\s+request\b/i,
    ],
  },
  {
    id: "clinician-deletes-patient",
    why: "There is no way for a clinician to delete a patient (lib/data/patients.ts).",
    patterns: [
      /\bclinicians?\s+(?:can|may)\s+(?:export\s+(?:or|and)\s+)?(?:delete|erase|remove)\s+(?:a|the|their)\s+patient/i,
      /\b(?:retained|kept)\s+until\s+deleted\s+by\s+the\s+(?:practice|clinician)/i,
    ],
  },
  {
    id: "nobody-reads-notes",
    why: "Staff have audited emergency access to charts (lib/data/admin.ts).",
    patterns: [
      /\b(?:nobody|no one|no-one)\s+(?:else\s+)?(?:at|from)\s+24Therapy\s+(?:ever\s+)?(?:reads|can read|sees|can see|opens|can open)\b/i,
    ],
  },
  {
    id: "unregistered-entity",
    why: "No 24Therapy company is registered yet (lib/settings/defs.ts, invoice entities).",
    patterns: [/\b24Therapy\s+(?:Inc\b\.?|LLC\b|Ltd\b\.?|Limited\b|Egypt\b|S\.A\.E\.?)/],
  },
  {
    id: "audit-nobody-can-edit",
    why: "The audit log is append-only by a database trigger, which the database owner could remove.",
    patterns: [
      /\b(?:nobody|no one|no-one)\s+(?:can|could)\s+(?:edit|change|alter|rewrite|delete)\b[^.]{0,40}\bincluding\s+us\b/i,
      /\bnot\s+even\s+us\b/i,
      /(?:لا\s+يمكن\s+لأحد|لا\s+أحد\s+يستطيع)[^.]{0,60}(?:حتى\s+نحن|بما\s+في\s+ذلك\s+نحن)/,
    ],
  },
];

export type ClaimHit = { where: string; rule: string; why: string; text: string };

/**
 * Every string a reader could see in a block tree. A FAQ item is also read as
 * its question and answer together, because "Is a BAA included?" and "Yes"
 * are only false side by side.
 */
export function claimStrings(value: unknown, path = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((entry, index) => claimStrings(entry, `${path}[${index}]`));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const own = Object.entries(record).flatMap(([key, entry]) =>
      ["type", "icon", "demo", "slug", "backgroundImage", "ctaHref", "entity"].includes(key)
        ? []
        : claimStrings(entry, path ? `${path}.${key}` : key),
    );
    if (typeof record.q === "string" && typeof record.a === "string") {
      own.push({ path: `${path}.qa`, text: `${record.q} ${record.a}` });
    }
    return own;
  }
  return [];
}

/** Every forbidden claim in one passage. */
export function claimsIn(where: string, text: string): ClaimHit[] {
  const hits: ClaimHit[] = [];
  for (const rule of FORBIDDEN_CLAIMS) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match) {
        hits.push({ where, rule: rule.id, why: rule.why, text: match[0] });
        break;
      }
    }
  }
  return hits;
}

/** Every forbidden claim in a page's blocks. */
export function forbiddenClaimsIn(label: string, blocks: unknown): ClaimHit[] {
  return claimStrings(blocks).flatMap((entry) =>
    claimsIn(`${label}${entry.path ? ` ${entry.path}` : ""}`, entry.text),
  );
}

/** What an admin reads when a save is refused. */
export function claimMessage(hit: ClaimHit): string {
  return `This page says "${hit.text}", which is not true today: ${hit.why} Correct the sentence before publishing.`;
}

/**
 * Statements a page must make. Checked over the defaults and the rows, not at
 * render time: a missing sentence is not a false one.
 */
export const REQUIRED_STATEMENTS: { slug: string; locale: string; what: string; pattern: RegExp }[] = [
  {
    slug: "privacy",
    locale: "en",
    what: "where the data is held: the United States, Oregon, Vercel and Neon, and OpenAI in the US",
    pattern: /Oregon[\s\S]*Vercel[\s\S]*Neon[\s\S]*OpenAI|Vercel[\s\S]*Neon[\s\S]*Oregon[\s\S]*OpenAI/,
  },
];
