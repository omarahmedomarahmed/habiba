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
