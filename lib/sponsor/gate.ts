import type { IdentifierKind } from "@/lib/db/schema";

/**
 * 🔴 THE GATE, AS ONE PURE FUNCTION BOTH SIDES RUN. W2-S06.
 *
 * `matchesGate` lived in `lib/data/enrolment.ts`, which is server only, so the
 * settings form could not show a company what its own gate admits. It is here
 * now, with no database and no server import, and enrolment imports it from
 * here: the test box on the settings page and the real enrolment are the same
 * code, so "this would get in" cannot disagree with what happens.
 */

/**
 * 🔴 Does this identifier cross the gate? A SHAPE AND A DOMAIN, never a list.
 *
 * C246: *prefer an identifier we can prove over one we can only pattern-match.*
 * A `domain_email` is real proof of control once the code sent to it is
 * answered; an `id_number` matched by shape is a weak gate, permitted, and the
 * sponsor is told in plain words that it is guessable and that they carry the
 * risk.
 */
export function matchesGate(
  field: { kind: IdentifierKind; domain: string | null; pattern: string | null },
  value: string,
): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;

  if (field.kind === "domain_email") {
    if (!field.domain) return false;
    /*
     * Exactly one @, and the domain matched whole. `endsWith` alone would let
     * `me@notuniversity.edu` through a gate for `university.edu`.
     */
    const parts = trimmed.split("@");
    if (parts.length !== 2 || !parts[0]) return false;
    return parts[1] === field.domain.trim().toLowerCase();
  }

  if (!field.pattern) return false;
  try {
    /* Anchored both ends, so a pattern for six digits cannot match sixty. */
    return new RegExp(`^(?:${field.pattern})$`).test(trimmed);
  } catch {
    // A pattern an admin typed wrongly refuses everybody rather than admitting
    // everybody, which is the safe direction for a gate.
    return false;
  }
}

/**
 * 🔴 W2-S06: THE SHAPES A COMPANY PICKS, INSTEAD OF A PATTERN IT TYPES.
 *
 * The form asked "How would you describe a valid one" twice, once for the
 * pattern and once for the hint, and compiled the first as a regular
 * expression. An HR person who typed a description got a gate that matched
 * nobody, with nothing to say so. A company now picks a shape and a length,
 * and the pattern is built here.
 */
export const IDENTIFIER_PRESETS = ["digits", "prefixed"] as const;
export type IdentifierPreset = (typeof IDENTIFIER_PRESETS)[number];

/** The longest number a preset may ask for. Past this it is not a staff number. */
export const PRESET_MAX_LENGTH = 20;

export function presetPattern(input: {
  preset: string;
  length: number;
  prefix: string;
}): string | null {
  const length = Math.round(input.length);
  if (!Number.isFinite(length) || length < 1 || length > PRESET_MAX_LENGTH) return null;

  if (input.preset === "digits") return `[0-9]{${length}}`;

  if (input.preset === "prefixed") {
    /*
     * 🔴 Lowercased, because `matchesGate` lowercases what the employee types:
     * "EMP" kept in capitals would refuse every card it was copied from. And
     * escaped, because a prefix is text: "A." must not admit "AB".
     */
    const prefix = input.prefix.trim().toLowerCase();
    if (!/^[a-z0-9.\-/]{1,10}$/.test(prefix)) return null;
    return `${prefix.replace(/[.\-/]/g, (char) => `\\${char}`)}[0-9]{${length}}`;
  }

  return null;
}
