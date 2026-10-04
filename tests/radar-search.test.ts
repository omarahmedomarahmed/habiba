import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { matchesSearch, normaliseSearch } from "../lib/radar-search";
import { activeCount, matches, NO_FILTER, specialtyIcon } from "../components/radar/filters";

/* The home page globe: search, big chips with icons, and a card that never moves the planet. */

const omar = {
  firstName: "Omar",
  lastName: "Abdelgawad",
  languages: ["Arabic", "English"],
  specialties: ["Anxiety", "Sleep"],
  country: "EG",
  region: null,
  city: "Cairo",
  practice: null,
};
const amira = { ...omar, firstName: "أميرة", lastName: "حسن", specialties: ["Trauma & PTSD"] };

test("normalising folds the Arabic spellings people actually type", () => {
  assert.equal(normaliseSearch("أميرة"), "اميره");
  assert.equal(normaliseSearch("إيمان"), "ايمان");
  assert.equal(normaliseSearch("آمال"), "امال");
  assert.equal(normaliseSearch("مُصْطَفَى"), "مصطفي");
  assert.equal(normaliseSearch("  José   ÁLVAREZ "), "jose alvarez");
});

test("search finds a clinician by name, in either script, case and hamza blind", () => {
  assert.ok(matchesSearch(omar, "omar"));
  assert.ok(matchesSearch(omar, "ABDEL"));
  assert.ok(matchesSearch(omar, "omar abdelgawad"));
  assert.ok(!matchesSearch(omar, "sara"));
  assert.ok(matchesSearch(amira, "اميره"), "alif without hamza and ه for ة");
  assert.ok(matchesSearch(amira, "أميرة حسن"));
});

test("search finds a specialty by its English or Arabic label on either page", () => {
  assert.ok(matchesSearch(omar, "anxiety"));
  assert.ok(matchesSearch(omar, "قلق"));
  assert.ok(matchesSearch(omar, "النوم"));
  assert.ok(matchesSearch(amira, "ptsd"));
  assert.ok(matchesSearch(amira, "الصدمه"), "ة typed as ه");
  assert.ok(!matchesSearch(omar, "الصدمة"));
  assert.ok(matchesSearch(omar, ""), "an empty box is everyone");
  assert.ok(matchesSearch(omar, "   "));
});

test("the search is one more filter: it narrows the globe and the list and is cleared with the rest", () => {
  assert.ok(matches(omar, { ...NO_FILTER, query: "omar" }));
  assert.ok(!matches(omar, { ...NO_FILTER, query: "zzzz" }));
  assert.ok(!matches(omar, { ...NO_FILTER, query: "omar", languages: ["French"] }));
  assert.equal(activeCount({ ...NO_FILTER, query: "omar" }), 1);
  assert.equal(activeCount({ ...NO_FILTER, query: "  " }), 0);
  assert.equal(NO_FILTER.query, "");
});

test("every built-in specialty chip has its own icon, and an unknown one a generic icon", () => {
  const generic = specialtyIcon("Something nobody planned for");
  assert.notEqual(specialtyIcon("Anxiety"), generic);
  assert.notEqual(specialtyIcon("Work stress & burnout"), specialtyIcon("Anxiety"), "work stress is not anxiety");
  assert.notEqual(specialtyIcon("Panic attacks"), specialtyIcon("Anxiety"));
  for (const s of ["Depression", "Trauma & PTSD", "Grief & loss", "Addiction", "Eating disorders", "OCD", "Relationships", "Sleep", "Children & teens"]) {
    assert.notEqual(specialtyIcon(s), generic, s);
  }
});

test("the card over the home globe is an overlay, not a block that pushes the globe", () => {
  const hero = readFileSync("components/public/audience-rotator.tsx", "utf8");
  /* Chips alone above the globe; the box and the offline card float inside the globe's square. */
  assert.doesNotMatch(hero, /<RadarChips[^>]*\/>\s*<GlobeInfo/);
  assert.match(hero, /pointer-events-none absolute start-0 top-0 z-20[^"]*w-\[min\(20rem,calc\(100%-1rem\)\)\]/);
  assert.match(hero, /<OfflineCard anchored /);
  const card = readFileSync("components/radar/offline-card.tsx", "utf8");
  assert.match(card, /anchored \? "pointer-events-auto w-full" : "fixed inset-x-3 top-20/);
  /* The other hero keeps a fixed-height list, so nothing that comes and goes resizes the board. */
  const radarHero = readFileSync("components/radar/radar-hero.tsx", "utf8");
  assert.match(radarHero, /<div className="relative h-\[22rem\]">/);
  assert.match(radarHero, /<OfflineCard anchored /);
});
