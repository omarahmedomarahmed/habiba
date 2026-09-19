# 24Therapy, the logo brief

**Paste everything below the line into a fresh design session.** Every colour, radius, font
stack and icon rule in it was read out of `app/globals.css`, `components/ui/index.tsx` and
`app/layout.tsx` on 2026-09-19, not remembered. Where a token is defined but barely used, it
says so, because a designer handed a palette that the product does not actually paint with
will build a logo that never matches a screenshot.

---

# Design a logo system for 24Therapy

You are designing the identity for **24Therapy**, a live product. It is not a rebrand and
not a concept exercise: the colours, radii and icon language below are already shipped in
the application, and the logo has to sit inside them without anything being restyled to
accommodate it.

Deliver **three variations**: `24`, `24T`, and `24Therapy`. They are one system, described
at the end.

---

## 1 · What the company is

**24Therapy is the clinical record layer above whatever a therapist already uses.** Not a
scribe, not an EHR.

A therapist records a session, on a phone in a room or in our video call, and walks away
with a transcript, a SOAP note, clinical insights and a report they can send to the patient.
The patient owns that record and carries it to the next therapist. A second half of the
product is on-demand: a patient opens **Crisis Radar** and books a therapist who is free
right now.

It launches in **Egypt**, in Arabic and English, and the product is bilingual end to end.

**Who it is for:** working clinicians, clinic administrators, and the patients they see. Not
consumers browsing a wellness app.

**Tone:** precise, quiet, institutional. This is software that writes things into a person's
medical record. It should look like something a regulator would be comfortable with and a
clinician would not be embarrassed to have on screen with a patient in the room.

**The one thing to confirm before you commit to a concept:** what the `24` means. The
working reading is round-the-clock availability, which is what the on-demand half of the
product does. Ask rather than assume, and do not build a concept that collapses if the
answer is "it is just the name".

---

## 2 · The palette, exactly as shipped

Defined once, in `app/globals.css`, as Tailwind v4 `@theme` tokens.

### The four brand colours

| Token | Hex | Role | Where it actually appears |
|---|---|---|---|
| **`navy-500`** | **`#0A2342`** | **Primary. The identity colour** | The wordmark in the site header. `themeColor` in the browser chrome. The page's dot-grid texture. The session room surface (`navy-600`) |
| **`brand-500`** | **`#1F5EFF`** | **Primary interactive** | Every primary button. The focus ring on every control |
| **`teal-500`** | **`#2EC4B6`** | **Secondary accent** | The second button variant. Crisis Radar's signature colour |
| **`cyan-500`** | **`#24C8DB`** | **Tertiary, light only** | The atmosphere glow on the Crisis Radar globe, and nowhere else |

🔴 **Navy is the brand. Blue is the button.** They are different jobs and the logo belongs to
navy. A mark drawn in `#1F5EFF` will read as a call to action sitting in a header.

🔴 **Cyan is a glow, not a colour you may build on.** It appears nine times in the whole
codebase, all of them SVG gradient stops on a dark globe. Use it for light and atmosphere or
do not use it.

### The full ramps

Every step is a real token you may sample.

```
navy    50 #eef2f8   100 #d3dded   200 #a8bbd9   300 #7392bf   400 #3f66a0
       500 #0a2342   600 #091e39   700 #07182e   800 #051223   900 #030b17

brand   50 #eaf0ff   100 #d0dcff   200 #a3baff   300 #7595ff   400 #4776ff
       500 #1f5eff   600 #164ad6   700 #1039a6   800 #0b2a7a   900 #071b50

teal    50 #e6faf7   100 #c0f2eb   200 #8ae7db   300 #55dbcb   400 #38d0be
       500 #2ec4b6   600 #23a094   700 #1a7a71   800 #12564f   900 #0b3833

cyan   400 #4fd6e6   500 #24c8db   600 #1aa3b4
```

Note the navy ramp: `500` is the darkest step anyone uses for identity, and `600` to `900`
are surfaces. `navy-500 #0A2342` is the wordmark colour, not `navy-900`.

### Neutrals and surfaces

Tailwind's default `slate`, unmodified.

| | Value | Use |
|---|---|---|
| Page background | `slate-50` `#F8FAFC` | Every page outside the session room |
| Body text | `slate-900` `#0F172A` | |
| Secondary text | `slate-600` `#475569` | |
| Borders | `slate-200` `#E2E8F0` | Cards, the header rule |
| Card surface | white `#FFFFFF` | |
| **Radar void** | **`#04101F`** | The Crisis Radar's dark surface. A near-black navy, hardcoded in seven files |
| Session room | `navy-600` `#091E39` | The room paints edge to edge and switches the page texture off |

### Semantic colours, which the logo never uses

| | Value |
|---|---|
| Danger, destructive | `red-600` `#DC2626` |
| Success | `emerald-600` `#059669` |
| Warning, waiting on a person | `amber-500` `#F59E0B` |

**These are reserved.** A mark that uses red or amber will collide with a state, and on the
payments queue an amber logo beside an amber "awaiting confirmation" badge is a real
ambiguity rather than a style objection.

### The page texture

Worth knowing, because the logo sits on it. The page is not flat white: it carries a dot
grid plus two very soft washes, all at low opacity.

```css
radial-gradient(circle at 15%   0%, rgba(31, 94, 255, 0.05), transparent 45%)
radial-gradient(circle at 85% 100%, rgba(46, 196, 182, 0.05), transparent 45%)
a 24px dot grid, #0A2342 at 5% opacity
```

**Blue in the top left, teal in the bottom right, both at 5%.** If the identity uses a
gradient, that is the one the product already implies, and the direction is already set.

---

## 3 · Type

**There is no licensed typeface.** The product runs on the system stack, deliberately:

```
ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
"Helvetica Neue", Arial, sans-serif
```

The wordmark in the header today is plain text: **bold, tight tracking, `navy-500`, 15px.**
That is a placeholder, and replacing it is part of this job.

Two consequences:

1. **The logo wordmark is lettering, not a font call.** You may draw it in whatever
   typeface you like and deliver it as outlines. Nothing has to be licensed for the web.
2. **It has to sit next to the system sans without looking imported.** In the header it will
   be 40px from nav links set in Inter on Windows, SF on a Mac and Roboto on Android. A
   wordmark with a strong personality is fine. One that makes the nav beside it look like a
   different company is not.

---

## 4 · Shape language

| | Value |
|---|---|
| `--radius-xl` | `0.875rem` = **14px** |
| `--radius-2xl` | `1.125rem` = **18px** |
| `--radius-3xl` | `1.5rem` = **24px** |

**Cards are 18px. Buttons are 12px to 18px depending on size. Badges are full pills.**

The product is round-cornered and soft-edged, with no sharp 90 degree corners anywhere in
the chrome. A hard-edged geometric mark will be the only square thing on the screen.

---

## 5 · The icon system, which the mark has to live beside

**`lucide-react` 0.469.** Imported in **127 files**. Nothing overrides its defaults, so
every icon in the product is drawn to exactly this spec:

| | |
|---|---|
| Grid | 24 x 24 |
| Stroke | **2px** |
| Fill | **none**, always |
| Caps | round |
| Joins | round |
| Colour | `currentColor`, inherited from the text beside it |

🔴 **This is the single hardest constraint in the brief.** If the `24` mark is line-based, it
must be drawn on a 24px grid at 2px stroke with round caps and joins, or it will be the one
shape in the interface with the wrong weight, and it will be obvious in the bottom
navigation where it sits directly between two Lucide glyphs.

A solid or filled mark is also allowed, and sidesteps the problem by clearly being a
different class of object. What is not allowed is a line mark at 1px or 3px, or with square
caps.

---

## 6 · What already exists

| | |
|---|---|
| Wordmark | Plain bold text, `24Therapy`, `navy-500`, in the site header and footer |
| `app/icon.png` | 512 x 512 PNG |
| `app/apple-icon.png` | 180 x 180 PNG |
| `app/favicon.ico` | present |
| Browser theme colour | `#0A2342` |
| Deployed at | `24t.vercel.app`, so `24T` is already in use as the short form |

All of it is placeholder. You are replacing it.

---

## 7 · Bilingual, and this is a hard requirement

The product ships **English and Arabic**, with a full RTL layout, and the language switch is
on every public page.

🔴 **The brand name stays Latin inside Arabic sentences.** It is never transliterated. Real
strings from the product:

```
"موثّق من 24Therapy"          Verified by 24Therapy
"هناك خطأ ما، أخبر 24Therapy"  Something is wrong, tell 24Therapy
"ما مدى سهولة استخدام 24Therapy؟"  How easy was 24Therapy to use?
```

So the wordmark must:

- Read correctly when the page direction is RTL and it sits at the **right** edge of the
  header rather than the left.
- Sit inside a line of Arabic text without fighting it. Arabic has a strong horizontal
  baseline and a different optical weight from Latin; a very light or very condensed
  wordmark will look wrong embedded in it.
- Work with a mark on either side, because a lockup that only works mark-left breaks in RTL.

An Arabic wordmark is **not** being asked for. If you want to propose one as a bonus, say
clearly that it is a proposal.

---

## 8 · The three variations

### `24`, the icon

**The app icon, the favicon, the avatar, the loading state.**

| | |
|---|---|
| Canvas | Square, designed at 512 x 512 |
| Must read at | **16px.** This is the test that kills most concepts |
| Backgrounds | Must work on white, on `slate-50`, and on `navy-500` |
| Safe area | Keep the mark inside the central 80%; iOS and Android both crop |

It may be the numerals themselves, a mark, or the two combined. If the numerals do the work,
`2` and `4` must not merge into a smudge at 16px, which is what usually happens.

### `24T`, the compact lockup

**Tight horizontal spaces: the session room header, the bottom navigation, a favicon
alternative, the `24t.vercel.app` short form.**

| | |
|---|---|
| Shape | Horizontal, roughly 3:1 or tighter |
| Must sit | Between two Lucide icons in a 44px tall bar without looking heavier than them |
| Height | Legible down to 20px tall |

The `T` has to be unambiguously the start of "Therapy" and not read as a unit or a
trademark mark.

### `24Therapy`, the full wordmark

**The site header, the footer, email, the patient's record extract, the verification page a
third party opens to check a record is genuine.**

| | |
|---|---|
| Today | 15px, bold, tight tracking, `navy-500` |
| Must work at | 15px in a 56px header, and large on a dark hero |
| Lockups | Horizontal with the mark, and stacked. Both |
| Direction | Must survive being mirrored into an RTL header |

---

## 9 · Deliverables

For each of the three:

1. **SVG, outlined**, no live text, no embedded fonts.
2. **Full colour** on light, **full colour** on dark (`navy-500` and `#04101F`).
3. **One colour**, solid `navy-500`, for stamps, faxes and a patient's printed record.
4. **Reversed**, solid white, for the session room and the radar.
5. `24` additionally as **PNG at 512, 180 and 32**, and an `.ico`.

Plus, in one page:

- The colour values you used, by token name from section 2.
- Minimum sizes and clear space.
- The lockup rules: what may be paired with what, and what may not.
- What you are **not** allowed to do to it.

---

## 10 · Do not

- **No medical cross, no caduceus, no stethoscope.** This is not a hospital.
- **No brain, no lightbulb, no head-in-profile with something inside it.** This is not an AI
  startup logo from 2023.
- **No speech bubble with a heart in it**, and no two-people-embracing pictogram. This is
  clinical documentation, not a support group.
- **No red and no amber.** They are reserved states, see section 2.
- **No gradient that has to survive 16px.** One soft brand-to-teal wash in a large
  application is fine; a three-stop gradient in a favicon is mud.
- **No pastel, no rounded-bubble friendliness.** The buyer is a clinician deciding whether
  to trust this with a patient's record.
- **No infinity loop, no abstract swoosh, no orbiting dot.**
- **No drop shadow baked into the mark.**

---

## 11 · How to work

Show **three distinct directions** first, as rough black and white `24` marks at 16px and at
512px side by side, with one sentence each on the idea. Do not colour anything and do not
build the other two variations until a direction is chosen.

Small first, always. A mark that survives 16px in one colour will survive everything else.
