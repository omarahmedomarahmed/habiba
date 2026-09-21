# 24T — logo pack

Vector traced from the supplied artwork. One closed contour, no live text, no embedded
fonts. Mean deviation from the source 0.40px, worst point 1.03px, measured against the
1254px original — sub-pixel at every size.

Proportion is fixed at **2.348 : 1** (`viewBox 0 0 1000 425.948`).
Stroke is a constant 20.4% of the mark's height, round caps and joins throughout.

## The three inks

| Token | Hex | Where it is used |
|---|---|---|
| `navy-500` | `#0A2342` | The identity. Light grounds, print, stamps, a patient's record extract. |
| `teal-500` | `#2EC4B6` | Crisis Radar only, on `radar-void`. It reads 2.19:1 on white, so never on a light ground. |
| `white` | `#FFFFFF` | Reversed, on `navy-600` in the session room and on `radar-void`. |

`brand-500` `#1F5EFF` is the interactive colour and is never the mark.

Each file names its own ink rather than inheriting `currentColor`, because an `<img>`
cannot inherit one.

## Which ink on which ground

- navy on `white` — yes
- navy on `slate-50` `#F8FAFC` — yes
- white on `navy-600` `#091E39` — yes
- white on `radar-void` `#04101F` — yes
- teal on `radar-void` — yes
- teal on `white` — no, 2.19:1
- navy on any dark ground — no

## Clear space and minimum size

Clear space on all four sides is one stroke width, **0.20 × the mark's height**.
Minimum size is **20px tall** on screen and **6mm tall** in print.

## Lockups

The mark is a single path: the 24 and the T are one object and are never separated,
re-spaced or set at different weights. In an RTL header the mark moves to the other
edge of the row; it is never mirrored or rotated.

## Never

- Never recolour it outside the three inks above.
- Never outline it, add a stroke, or bake in a shadow.
- Never stretch it; the proportion is fixed.
- Never rotate or mirror it.
- Never separate the 24 from the T.
- Never set it on a photograph or a patterned ground.
- Never set it below 20px tall.

## Files

```
svg/24T-navy.svg          the working vector, one per ink
svg/24T-teal.svg
svg/24T-white.svg
png/24T-<ink>-<w>.png     transparent, 1024 / 512 / 256 / 128 / 64 wide
app-icon/icon-512.png     navy tile, mark reversed in white, 21.9% radius
app-icon/icon-180.png     and apple-icon-180.png
app-icon/icon-32.png
app-icon/favicon.ico      16, 32 and 48, each rendered at its own size
app-icon/icon-512-transparent.png   navy mark, no tile
```

The app icon is a navy tile with the mark reversed, because a 2.348:1 mark cannot fill
a square on its own. It stands in until the square `24` variation exists.
