/**
 * 🔴 65.21 — THE PRODUCT'S NAME, AS A CONSTANT RATHER THAN A LITERAL IN MARKUP.
 *
 * `scripts/_i18n-coverage.ts` says in its own opening paragraph that it cannot tell a
 * proper noun from a sentence, so "24Therapy" counts against a file "until somebody
 * moves them out of JSX". That is the instruction and this is the move.
 *
 * 🔴 IT IS NOT A DICTIONARY KEY, and the difference matters. A key is something an
 * administrator can publish a different value for, per language, and there is no
 * language in which this product is called something else. Making it translatable would
 * invite exactly one kind of edit and every one of them would be a mistake.
 */
export const BRAND = "24Therapy";
