/**
 * 🔴 77.13 — WHAT A `"use server"` FILE MAY EXPORT, AND WHY THIS MOVED.
 *
 * All of this lived in `app/(admin)/admin/actions.ts`, which carries
 * `"use server"` at the top. Such a file may export async functions and
 * nothing else, and sprint 76 added `export const SANITISER_BLOCK_TYPES` to it
 * so `verify:sprint17` could compare the sanitiser's keys against the block
 * union. An exported array.
 *
 * It sat there working for a sprint, because Next validates a server module's
 * exports when something pulls it into a page's graph and the pages that
 * imported it did not trip the check. The moment `/admin/settings` imported an
 * action from that file, the whole page answered 500 with
 * *"A `use server` file can only export async functions, found object"* — an
 * error naming a file the operator was not editing, on a screen that had been
 * working an hour earlier.
 *
 * 🔴 IT WAS FOUND BY READING `/admin/errors` ON PRODUCTION, which is what that
 * page is for, and it would not have been found any other way: it compiles, it
 * typechecks, no gate reads it, and it is invisible until a particular import
 * edge exists.
 *
 * So the rule is the shape now: actions live in the `"use server"` file, and
 * everything that is not an action lives here, where exporting a constant is
 * ordinary.
 */
import { safeImageUrl } from "@/lib/content/url";
import type { ContentBlock } from "@/lib/db/schema";

/*
 * 🔴 76.77 — THE SANITISER REFUSED EVERY PAGE THIS PRODUCT ACTUALLY HAS.
 *
 * ## What it did
 *
 * It accepted six block types, `hero prose features showcase faq cta`, and
 * returned `null` for anything else — which makes `savePage` answer *"The
 * content structure is not valid. Check the block editor."* and write nothing.
 *
 * The homepage carries `pricing` and `crisis`. The pricing page carries
 * `pricing`. The patients page carries `flow` and `seesWhat`. The contact page
 * carries `contact_form`. **So an operator opening any of those in the console,
 * fixing one typo and pressing Publish got a refusal with a message telling
 * them to check a block editor that was not the problem.** The only pages that
 * could be saved were the legal ones.
 *
 * Nine block types have shipped since this list was written and not one of them
 * was added to it. That is the cost of an allow-list kept by hand next to a type
 * union that grows: the union is the definition and the list is a copy, and a
 * copy drifts (H41, C60, and the door count earlier in this same sprint).
 *
 * ## What it does now
 *
 * The table below is keyed by every member of the union, and `verify:sprint17`
 * asserts the two sets are equal by reading the union out of the schema, so a
 * tenth block type cannot ship without this file being edited. Each entry names
 * the scalar fields that type carries and the shape of its items, because the
 * second half of the old defect was as bad as the first: even on an accepted
 * type, any key outside `TEXT_KEYS` was silently dropped. Saving a page with a
 * comparison table on it would have stripped every rival's rows, prices and
 * logos and written the wreckage back.
 *
 * Text is still text. Nothing here admits HTML, every string is length-capped,
 * and `backgroundImage` still goes through `safeImageUrl`. The widening is in
 * WHICH fields survive, never in what a field may contain.
 */

/** Image URLs get their own rule — see `safeImageUrl`. */
const URL_KEYS = new Set(["backgroundImage"]);

/** A field that is a list of plain strings, kept as one. */
const STRING_LIST_KEYS = new Set(["can", "cannot"]);

type BlockRule = {
  /** Scalar string fields this type may carry. */
  keys: string[];
  /** The array field's name, and the keys each of its entries may carry. */
  items?: { field: string; keys: string[]; nested?: { field: string; keys: string[] } };
  /** Booleans this type may carry. */
  flags?: string[];
};

const RULES: Record<string, BlockRule> = {
  hero: {
    keys: ["eyebrow", "heading", "body", "ctaLabel", "ctaHref", "demo", "icon", "backgroundImage"],
  },
  audiences: {
    keys: ["stem", "ctaLabel", "ctaHref"],
    items: {
      field: "panels",
      keys: ["label", "clause", "body", "href", "hrefLabel", "demo"],
    },
  },
  howItWorks: {
    keys: ["heading", "body"],
    items: { field: "items", keys: ["audience", "title", "body", "demo"] },
  },
  prose: { keys: ["heading", "body", "icon"] },
  features: { keys: ["heading"], items: { field: "items", keys: ["title", "body", "icon"] } },
  showcase: {
    keys: ["heading", "body"],
    flags: ["side"],
    items: { field: "items", keys: ["title", "body", "icon", "demo"] },
  },
  faq: { keys: ["heading"], items: { field: "items", keys: ["q", "a"] } },
  flow: { keys: ["heading"], items: { field: "steps", keys: ["title", "detail"] } },
  seesWhat: { keys: ["heading", "who", "can", "cannot"] },
  pricing: { keys: [], flags: ["compact"] },
  companies: {
    keys: ["heading"],
    items: {
      field: "items",
      keys: ["title", "entity", "address", "phone", "email", "hours", "body"],
    },
  },
  contact_form: { keys: ["heading", "body"] },
  walkthrough: { keys: ["which"] },
  competitors: {
    keys: ["heading", "checkedOn"],
    items: {
      field: "items",
      keys: ["name", "logo", "who", "price"],
      nested: { field: "rows", keys: ["claim", "ours", "theirs"] },
    },
  },
  vendors: {
    keys: ["heading", "kind"],
    items: { field: "items", keys: ["name", "logo", "via", "status"] },
  },
  crisis: { keys: ["heading", "body"] },
  cta: { keys: ["heading", "body", "ctaLabel", "ctaHref", "backgroundImage"] },
};

/**
 * 🔴 Read by `verify:sprint17`, which compares it against the `ContentBlock`
 * union in the schema. Exported so the check reads the real thing rather than a
 * list somebody retyped into a verifier, which is how this drifted in the first
 * place.
 */
export const SANITISER_BLOCK_TYPES = Object.keys(RULES).sort();

/** The one boolean on a nested row, kept because the renderer reads it. */
const NESTED_FLAGS = new Set(["concede"]);

function pickStrings(source: unknown, keys: string[], cap = 4000): Record<string, unknown> {
  const from = (source ?? {}) as Record<string, unknown>;
  const target: Record<string, unknown> = {};
  for (const key of keys) {
    const value = from[key];
    if (typeof value === "string") target[key] = value.slice(0, cap);
  }
  return target;
}

export function sanitiseBlocks(raw: unknown): ContentBlock[] | null {
  if (!Array.isArray(raw)) return null;

  const clean: ContentBlock[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const block = entry as Record<string, unknown>;
    const type = typeof block.type === "string" ? block.type : null;
    const rule = type ? RULES[type] : undefined;
    if (!type || !rule) return null;

    const output: Record<string, unknown> = { type };

    for (const key of rule.keys) {
      const value = block[key];
      if (URL_KEYS.has(key)) {
        const safe = safeImageUrl(value);
        if (safe) output[key] = safe;
        continue;
      }
      if (STRING_LIST_KEYS.has(key)) {
        if (Array.isArray(value)) {
          output[key] = value
            .filter((one): one is string => typeof one === "string")
            .map((one) => one.slice(0, 4000));
        }
        continue;
      }
      if (typeof value === "string") output[key] = value.slice(0, 8000);
    }

    for (const flag of rule.flags ?? []) {
      if (typeof block[flag] === "boolean") output[flag] = block[flag];
    }

    if (rule.items) {
      const value = block[rule.items.field];
      if (!Array.isArray(value)) return null;
      const spec = rule.items;
      output[spec.field] = value.map((item) => {
        const target = pickStrings(item, spec.keys);
        if (spec.nested) {
          const rows = (item as Record<string, unknown> | null)?.[spec.nested.field];
          target[spec.nested.field] = Array.isArray(rows)
            ? rows.map((row) => {
                const kept = pickStrings(row, spec.nested!.keys);
                const source = (row ?? {}) as Record<string, unknown>;
                for (const flag of NESTED_FLAGS) {
                  if (typeof source[flag] === "boolean") kept[flag] = source[flag];
                }
                return kept;
              })
            : [];
        }
        return target;
      });
    }

    clean.push(output as ContentBlock);
  }

  return clean;
}


/**
 * Discount an issued invoice.
 *
 * The amount is clamped server-side: a discount larger than the bill would make
 * the payable total negative and the ledger meaningless. A full discount
 * settles the invoice rather than leaving a zero-value bill sitting as "due".
 */
