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

export type DocumentRequirement = {
  key: "idFront" | "idBack" | "licenseDoc" | "headshot";
  label: string;
  hint: string;
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
    "Department of Health – Abu Dhabi (DoH)",
    "Dubai Health Authority (DHA)",
    "Ministry of Health and Prevention (MOHAP)",
    "Dubai Healthcare City Authority (DHCA)",
  ],
  SA: ["Saudi Commission for Health Specialties (SCFHS)"],
  QA: ["Department of Healthcare Professions (DHP), Ministry of Public Health"],
  KW: ["Kuwait Ministry of Health — Licensing Department"],
  BH: ["National Health Regulatory Authority (NHRA)"],
  OM: ["Oman Medical Specialty Board", "Ministry of Health — Directorate of Licensing"],
  EG: [
    "Egyptian Syndicate of Psychologists and Sociologists (نقابة المهن الاجتماعية)",
    "Ministry of Health and Population — Mental Health Secretariat",
    "Egyptian Medical Syndicate (نقابة الأطباء)",
  ],
  JO: ["Jordanian Nursing and Allied Health Council", "Ministry of Health — Licensing"],
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
  DE: ["Landespsychotherapeutenkammer", "Approbation — Landesprüfungsamt"],
  FR: ["Agence Régionale de Santé (ARS) — numéro ADELI"],
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
  TR: ["Türk Psikologlar Derneği", "Ministry of Health — Licensing"],
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
  PH: ["Professional Regulation Commission (PRC) — Board of Psychology"],
  ID: ["Himpunan Psikologi Indonesia (HIMPSI)"],
  JP: ["Certified Public Psychologist (公認心理師) — MHLW"],
  KR: ["Korean Clinical Psychology Association"],
  CN: ["Chinese Psychological Society"],
};

export function regulatorsFor(country: string | null | undefined): string[] {
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
export function documentRequirements(country: string | null): DocumentRequirement[] {
  const idFront =
    country === "EG"
      ? "National ID (البطاقة) — front"
      : country === "AE"
        ? "Emirates ID — front"
        : country === "SA"
          ? "National ID or Iqama — front"
          : country === "QA"
            ? "Qatar ID (QID) — front"
            : country === "KW"
              ? "Civil ID — front"
              : country === "BH"
                ? "CPR card — front"
                : country === "OM"
                  ? "Resident Card — front"
                  : country === "US"
                    ? "Driver's licence or passport — front"
                    : country === "GB"
                      ? "Passport or driving licence — front"
                      : country === "IN"
                        ? "Aadhaar or passport — front"
                        : country === "PK"
                          ? "CNIC — front"
                          : country === "NG"
                            ? "NIN slip or passport — front"
                            : "Government ID — front";

  const idBack =
    country === "EG"
      ? "National ID (البطاقة) — back"
      : country === "AE"
        ? "Emirates ID — back"
        : country === "PK"
          ? "CNIC — back"
          : "Government ID — back";

  const licence =
    country === "EG"
      ? "Syndicate card or practising licence"
      : country === "AE"
        ? "DoH / DHA / MOHAP professional licence"
        : country === "GB"
          ? "HCPC, BACP or UKCP registration certificate"
          : country === "US"
            ? "State licence certificate"
            : "Practising licence or registration certificate";

  return [
    {
      key: "idFront",
      label: idFront,
      hint: "A clear photo. All four corners visible, no glare over the text.",
      required: true,
    },
    {
      key: "idBack",
      label: idBack,
      // A passport has no back; demanding one produces a photo of nothing.
      hint: "Skip this if you uploaded a passport page.",
      required: false,
    },
    {
      key: "licenseDoc",
      label: licence,
      hint: "Whatever your regulator issues — a card, a licence, a registration certificate.",
      required: true,
    },
    {
      key: "headshot",
      label: "Professional headshot",
      hint: "This one is public: it appears on your radar profile. Plain background, your face clearly visible.",
      required: true,
    },
  ];
}
