# The homepage rows as they were, before the rewrite

`home-production-2026-09-21.json` is every `content_pages` row for the `home`
slug on production, all four locales, taken immediately before task 137
replaced five `hero` blocks with one `audiences` block.

## Why a file rather than a promise

`scripts/sync-blocks.ts` exists because `ship:content` destroyed 6,810 bytes of
authored copy, twice, on the same three rows. Both recoveries came out of a Neon
preview branch, and the note there ends: there is no third preview branch
waiting.

This edit went through `content:sync`, which replaces only the named block types
and refuses to write unless every other block comes out byte-identical. The dry
run against production reported `untouched 6162 bytes, unchanged` for English
and `5525 bytes, unchanged` for Arabic, so the four blocks that were not part of
the rewrite (pricing, competitors, crisis, cta) were provably not touched.

The file is here anyway, because the whole lesson of H49 is that the time to
have a copy is before you need one.

## How to put it back

Each row carries its own `id`. Restoring one is:

```sql
UPDATE content_pages SET blocks = '<blocks>'::jsonb WHERE id = '<id>';
```

---

# The for-patients rows, before the section cut

`for-patients-production-2026-09-21.json` is every `content_pages` row for the
`for-patients` slug on production, all four locales, taken immediately before
the edit that took the page from eleven sections to nine.

The live rows (`en`, `ar`) carried eleven blocks; the two `-x-staging` rows
carried nine and were not touched, because `content:sync` writes only the
locales `registry.ts` ships defaults for. That gap is worth knowing about: a
staging locale drifts on its own and no gate compares the two.

The dry run against production reported `untouched 2055 bytes, unchanged` for
English and `1868 bytes` for Arabic, so the hero, the FAQ and the crisis block
were provably not touched. This run also used `--order`, which the control
cannot fully see: reordering moves no bytes, so a synced block can pass an
untouched one without the remainders differing. That is the reason the flag has
to be typed out, and the reason this file exists for an edit whose control was
green.
