/**
 * Two claims this product is not allowed to make. PLAN.md 28.2, 28.3, C109, C110.
 *
 * ## 🔴 Why these two, and why they are code rather than a style note
 *
 * **"Paid sessions cover our fee" is arithmetically false** at the prices this
 * product is actually sold at. Fifteen per cent of a twenty dollar session is
 * three dollars against a four dollar fee. It is the kind of sentence that
 * writes itself into a pricing page because it *sounds* like the deal, and the
 * clinician who works it out in month three is the one who leaves.
 *
 * What is true is **netting**: what you owe comes out of what you earn before
 * it reaches your account. That is a real and genuinely good property, and it
 * survives being checked.
 *
 * **An earnings promise is a forecast about somebody else's business.** "Get
 * booked" is fine: it describes what the radar does. "Earn enough to cover it",
 * "make X a month", "pays for itself" are predictions we have no basis for, and
 * a clinician who moved practice on the strength of one has been misled by us
 * rather than by the market.
 *
 * ## Where this runs
 *
 * Two places, deliberately. `savePage` refuses to store an offending block, so
 * an admin cannot publish one; and `verify:sprint28` scans the **published
 * rows**, so a page seeded before this existed is caught too. C148 is the
 * reason for the second: the code being right has never been the same thing as
 * the database serving the right thing.
 *
 * ## What it deliberately does not do
 *
 * It does not try to judge tone, enthusiasm or marketing generally. Two
 * claims, named, with the shapes they actually take in writing. A checker that
 * tried to police persuasion would be switched off inside a month.
 */

export type HonestyHit = { where: string; rule: "fee" | "earnings"; text: string };

/**
 * "Paid sessions cover our fee", in the forms people write it.
 *
 * The pattern is a subject about sessions or patients, a verb of covering, and
 * the fee. Written as alternatives rather than one clever regex because the
 * next person to extend this should be able to see what each line catches.
 */
const FEE_CLAIMS: RegExp[] = [
  /\b(paid\s+)?sessions?\s+(more\s+than\s+)?(cover|covers|pay\s+for|pays\s+for|offset|offsets)\b[^.]{0,40}\b(fee|fees|cost|costs|bill|subscription)\b/i,
  /\b(the\s+)?(fee|fees|cost|costs|bill|subscription)\s+(is|are)\s+covered\s+by\b[^.]{0,40}\b(session|sessions|patient|patients)\b/i,
  /\bpays?\s+for\s+itself\b/i,
  /\b(one|a\s+single|a)\s+(paid\s+)?session\s+(covers|pays\s+for)\b/i,
  /\bcosts?\s+you\s+nothing\s+if\s+you\s+(see|take)\b/i,
];

/**
 * Earnings promises.
 *
 * 🔴 The hard part is the exclusions. "Earnings" is a legitimate word: there
 * is an earnings *page*, the fee comes out of held earnings, and a patient's
 * receipt talks about what the clinician was paid. Describing money that has
 * already moved is not a forecast. So the patterns below all require a
 * *future* or *quantified* shape — will earn, earn up to, make $X, double your
 * income — and never the bare noun.
 */
const EARNINGS_CLAIMS: RegExp[] = [
  /\b(you|therapists?|clinicians?)\s+(will|can|could|should)\s+(earn|make|take\s+home|bring\s+in)\b/i,
  /\bearn\s+(up\s+to|as\s+much\s+as|more|extra|an?\s+extra)\b/i,
  /\b(double|triple|grow|increase|boost|maximi[sz]e)\s+(your\s+)?(income|earnings|revenue|billings?)\b/i,
  /\b(make|earn)\s+[$£€]\s?\d/i,
  /\b(guaranteed|guarantee)\s+(income|earnings|bookings?|patients?)\b/i,
  /\b(fill|filling)\s+your\s+(calendar|diary|caseload)\b/i,
  /\b\d+\s*(x|times)\s+(your\s+)?(income|earnings|bookings?)\b/i,
];

/** Every string a reader could see, flattened out of a block tree. */
export function readableStrings(value: unknown, path = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => readableStrings(entry, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      /*
       * Keys that are machinery rather than prose. A slug or an icon name
       * cannot carry a claim, and including them only widens what a pattern
       * could accidentally match.
       */
      ["type", "icon", "demo", "slug", "backgroundImage", "ctaHref"].includes(key)
        ? []
        : readableStrings(entry, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

/** Check one passage. Returns every rule it breaks, in the order written. */
export function honestyProblems(where: string, text: string): HonestyHit[] {
  const hits: HonestyHit[] = [];

  for (const pattern of FEE_CLAIMS) {
    const match = text.match(pattern);
    if (match) {
      hits.push({ where, rule: "fee", text: match[0] });
      break;
    }
  }

  for (const pattern of EARNINGS_CLAIMS) {
    const match = text.match(pattern);
    if (match) {
      hits.push({ where, rule: "earnings", text: match[0] });
      break;
    }
  }

  return hits;
}

/** Check a whole block tree, as `savePage` and the verifier both do. */
export function honestyProblemsIn(label: string, blocks: unknown): HonestyHit[] {
  return readableStrings(blocks).flatMap((entry) =>
    honestyProblems(`${label}${entry.path ? ` ${entry.path}` : ""}`, entry.text),
  );
}

/** What an admin reads when a save is refused. Names the sentence, not the rule number. */
export function honestyMessage(hit: HonestyHit): string {
  return hit.rule === "fee"
    ? `This says the sessions cover our fee: "${hit.text}". At the prices this is sold at that is arithmetically false, fifteen per cent of a twenty dollar session is three dollars against a four dollar fee. What is true is netting: what you owe comes out of what you earn before it reaches your account. Say that instead.`
    : `This promises earnings: "${hit.text}". That is a forecast about somebody else's business, and we have no basis for it. Describe what the product does, "get booked", rather than what it will pay.`;
}
