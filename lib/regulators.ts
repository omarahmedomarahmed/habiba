/**
 * Who licenses a therapist, and what we ask them to photograph.
 *
 * Client-safe on purpose. Both live on the onboarding form and have to change
 * the instant somebody picks a country from the dropdown — asking a clinician
 * in Abu Dhabi to press Save before we will tell them which ID we want is a
 * step for no reason, and the reason it used to work that way is that this
 * lived on the server.
 *
 * The regulator lists are a *starting point*, never a constraint. The field
 * stays a free-text input with these offered beside it, because there are
 * dozens of routes to practising in most countries and a dropdown that omits
 * yours reads as "you are not welcome here". First entry is prefilled; the
 * rest are one tap away; anything else can be typed.
 */
import type { MessageKey } from "@/lib/i18n/messages";


export type DocumentRequirement = {
  /**
   * 🔴 The identifier. Never translated, never derived from a label (C203).
   *
   * It is the upload slot's name in the database and in the form, so a label
   * that changes language must not be able to change what this is.
   */
  key: "idFront" | "idBack" | "licenseDoc" | "headshot";
  /**
   * 45.6 / C207 — what the clinician reads, as a dictionary key.
   *
   * These were English string constants, on the first screen a clinician in
   * Cairo meets after signing up. A lib module cannot call a translator, so it
   * names the key and the component that renders it resolves it. That also
   * makes every one of them admin-overridable like any other string.
   */
  labelKey: MessageKey;
  hintKey: MessageKey;
  /**
   * A per-country label an administrator has configured, which wins over
   * `labelKey`. Raw text rather than a key, because an operator typing "Carte
   * Nationale" into the country config is naming a document, not adding a
   * string to the product.
   */
  label?: string;
  required: boolean;
};

/**
 * The regulators we can name with confidence, for the countries we are
 * actually recruiting in. A country missing from this table gets a free-text
 * field and no suggestions, which is honest — inventing a plausible-sounding
 * regulator would be worse than offering none.
 */
export const REGULATORS: Record<string, string[]> = {
  AE: [
    "Department of Health, Abu Dhabi (DoH)",
    "Dubai Health Authority (DHA)",
    "Ministry of Health and Prevention (MOHAP)",
    "Dubai Healthcare City Authority (DHCA)",
  ],
  SA: ["Saudi Commission for Health Specialties (SCFHS)"],
  QA: ["Department of Healthcare Professions (DHP), Ministry of Public Health"],
  KW: ["Kuwait Ministry of Health, Licensing Department"],
  BH: ["National Health Regulatory Authority (NHRA)"],
  OM: ["Oman Medical Specialty Board", "Ministry of Health, Directorate of Licensing"],
  EG: [
    "Egyptian Syndicate of Psychologists and Sociologists (نقابة المهن الاجتماعية)",
    "Ministry of Health and Population, Mental Health Secretariat",
    "Egyptian Medical Syndicate (نقابة الأطباء)",
  ],
  JO: ["Jordanian Nursing and Allied Health Council", "Ministry of Health, Licensing"],
  LB: ["Lebanese Order of Psychologists"],
  GB: [
    "Health and Care Professions Council (HCPC)",
    "British Association for Counselling and Psychotherapy (BACP)",
    "UK Council for Psychotherapy (UKCP)",
    "British Psychological Society (BPS)",
  ],
  IE: ["CORU", "Irish Association for Counselling and Psychotherapy (IACP)"],
  US: [
    "State Board of Psychology",
    "State Board of Behavioral Sciences (LMFT / LCSW / LPCC)",
    "State Board of Social Work Examiners",
  ],
  CA: ["College of Psychologists (provincial)", "College of Registered Psychotherapists (provincial)"],
  AU: ["Australian Health Practitioner Regulation Agency (AHPRA)", "Psychotherapy and Counselling Federation of Australia"],
  NZ: ["New Zealand Psychologists Board"],
  DE: ["Landespsychotherapeutenkammer", "Approbation, Landesprüfungsamt"],
  FR: ["Agence Régionale de Santé (ARS), numéro ADELI"],
  ES: ["Colegio Oficial de Psicólogos"],
  IT: ["Ordine degli Psicologi"],
  NL: ["BIG-register (CIBG)", "Nederlands Instituut van Psychologen (NIP)"],
  PT: ["Ordem dos Psicólogos Portugueses"],
  BE: ["Commission des Psychologues / Psychologencommissie"],
  CH: ["Federal Office of Public Health (PsyReg)"],
  SE: ["Socialstyrelsen"],
  NO: ["Helsedirektoratet"],
  DK: ["Psykolognævnet"],
  PL: ["Polskie Towarzystwo Psychologiczne"],
  TR: ["Türk Psikologlar Derneği", "Ministry of Health, Licensing"],
  IN: ["Rehabilitation Council of India (RCI)"],
  PK: ["Pakistan Psychological Association"],
  ZA: ["Health Professions Council of South Africa (HPCSA)"],
  NG: ["Nigerian Association of Clinical Psychologists"],
  KE: ["Kenya Counsellors and Psychologists Board"],
  BR: ["Conselho Regional de Psicologia (CRP)"],
  MX: ["Dirección General de Profesiones (cédula profesional)"],
  AR: ["Colegio de Psicólogos (provincial)"],
  SG: ["Singapore Psychological Society", "Allied Health Professions Council"],
  MY: ["Malaysian Society of Clinical Psychology"],
  PH: ["Professional Regulation Commission (PRC), Board of Psychology"],
  ID: ["Himpunan Psikologi Indonesia (HIMPSI)"],
  JP: ["Certified Public Psychologist (公認心理師), MHLW"],
  KR: ["Korean Clinical Psychology Association"],
  CN: ["Chinese Psychological Society"],
};

/**
 * 20.4 / 20.5 — what an administrator has configured for a country, if
 * anything.
 *
 * Passed into the onboarding form from the server as a plain map, because the
 * form relabels the moment somebody picks a country and cannot wait for a
 * round trip. An empty or missing entry falls through to the constants below,
 * which is why those stay: a country nobody has configured gets a shipped
 * answer rather than a blank label, and inventing a plausible regulator is
 * worse than offering none.
 */
export type CountryRequirements = {
  regulators?: string[];
  idLabelFront?: string | null;
  idLabelBack?: string | null;
  licenceLabel?: string | null;
  sampleImageUrl?: string | null;
};

export type RequirementOverrides = Record<string, CountryRequirements>;

export function regulatorsFor(
  country: string | null | undefined,
  overrides?: RequirementOverrides,
): string[] {
  const configured = overrides?.[(country ?? "").toUpperCase()]?.regulators ?? [];
  if (configured.length > 0) return configured;
  return regulatorsFromConstants(country);
}

function regulatorsFromConstants(country: string | null | undefined): string[] {
  return (country && REGULATORS[country]) || [];
}

/**
 * What we ask for, per country.
 *
 * The ID label matters more than it looks. "Government ID" to somebody in
 * Cairo is ambiguous — passport? syndicate card? — and the word for the thing
 * they are holding is البطاقة. Naming the actual document is the difference
 * between a correct upload and a support ticket.
 */
export function documentRequirements(
  country: string | null,
  overrides?: RequirementOverrides,
): DocumentRequirement[] {
  const configured = overrides?.[(country ?? "").toUpperCase()];
  const built = documentRequirementsFromConstants(country);

  if (!configured) return built;

  /*
   * Field by field, not all-or-nothing: an administrator who has named the
   * licence document but not the ID gets their licence label and the shipped
   * ID labels, rather than a form that reverts everything because one field
   * was left blank.
   */
  return built.map((slot) => {
    if (slot.key === "idFront" && configured.idLabelFront) {
      return { ...slot, label: configured.idLabelFront };
    }
    if (slot.key === "idBack" && configured.idLabelBack) {
      return { ...slot, label: configured.idLabelBack };
    }
    if (slot.key === "licenseDoc" && configured.licenceLabel) {
      return { ...slot, label: configured.licenceLabel };
    }
    return slot;
  });
}

/**
 * Which key names the document, per country.
 *
 * The country list is the same one it always was; what changed is that these
 * return dictionary keys rather than English. A country we cannot name falls
 * to `.default`, which says "Government ID" in both languages — honest,
 * because inventing a document a country does not issue produces a photo of
 * the wrong thing and a support ticket.
 */
const ID_FRONT_KEYS = [
  "EG", "AE", "SA", "QA", "KW", "BH", "OM", "US", "GB", "IN", "PK", "NG",
] as const;
const ID_BACK_KEYS = ["EG", "AE", "PK"] as const;
const LICENCE_KEYS = ["EG", "AE", "GB", "US"] as const;

function keyFor(
  slot: "idFront" | "idBack" | "licence",
  country: string | null,
  known: readonly string[],
): MessageKey {
  const code = known.includes(country ?? "") ? country : "default";
  return `tver.doc.${slot}.${code}` as MessageKey;
}

function documentRequirementsFromConstants(country: string | null): DocumentRequirement[] {
  return [
    {
      key: "idFront",
      labelKey: keyFor("idFront", country, ID_FRONT_KEYS),
      hintKey: "tver.doc.hint.idFront",
      required: true,
    },
    {
      key: "idBack",
      labelKey: keyFor("idBack", country, ID_BACK_KEYS),
      // A passport has no back; demanding one produces a photo of nothing.
      hintKey: "tver.doc.hint.idBack",
      required: false,
    },
    {
      key: "licenseDoc",
      labelKey: keyFor("licence", country, LICENCE_KEYS),
      hintKey: "tver.doc.hint.licence",
      required: true,
    },
    {
      key: "headshot",
      labelKey: "tver.doc.headshot",
      hintKey: "tver.doc.hint.headshot",
      required: true,
    },
  ];
}
