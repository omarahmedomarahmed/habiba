/**
 * Generate the app icons.
 *
 * Checked in as a script rather than run once by hand, because the icon is
 * brand and brand changes: regenerating it should be one command, not an
 * archaeology exercise in whatever tool happened to be open that day.
 *
 *   npx tsx scripts/icon.mts
 *
 * Chromium does the rendering, which is deliberate. The mark is type — the
 * numerals "24" — and type is the one thing you cannot ship as an SVG and
 * trust: a favicon rendered with `font-family: system-ui` is a different
 * shape on every operating system that opens it. Rasterising here bakes one
 * set of letterforms into the file, so the icon in a Windows tab is the icon
 * we approved.
 *
 * Three outputs, because browsers want three different things:
 *   app/favicon.ico   — 16/32/48, what a bare `/favicon.ico` request gets,
 *                       and what crawlers and older browsers ask for
 *   app/icon.png      — the modern <link rel="icon">, injected by Next
 *   app/apple-icon.png— 180×180 for an iOS home screen
 */
import { writeFileSync } from "node:fs";
import { globSync } from "node:fs";
import { chromium } from "playwright";

/** Navy, matching `themeColor` in the root layout. */
const NAVY = "#0A2342";

/**
 * The mark, as one page rendered at whatever size is asked for.
 *
 * Full-bleed rather than a padded glyph: at sixteen pixels every pixel spent
 * on margin is a pixel not spent on the numerals, and this icon has to be
 * legible in a tab strip next to twenty others.
 *
 * The radius scales with the tile, so the silhouette is the same shape at
 * 16px and at 512px. The optical nudge upward is because digits sit on a
 * baseline with descender space below them that they do not use, and centring
 * the box centres that empty space too.
 */
function page(size: number) {
  /*
   * Proportions chosen by rendering the alternatives and looking at them at
   * sixteen pixels, which is the only size that is actually hard. A tighter
   * radius and larger numerals win there — every percent of the tile given to
   * a corner or a margin is a percent not given to the two glyphs that have to
   * carry the mark in a tab strip.
   */
  const radius = Math.round(size * 0.18);
  const font = Math.round(size * 0.62);
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent}
    .tile{
      width:${size}px;height:${size}px;border-radius:${radius}px;
      background:${NAVY};
      display:flex;align-items:center;justify-content:center;
      font-family:"Liberation Sans","Helvetica Neue",Arial,sans-serif;
      font-weight:700;
      font-size:${font}px;
      letter-spacing:${-(size * 0.026).toFixed(2)}px;
      color:#fff;
      line-height:1;
      /*
        Asked for, but not the thing that fixes it.
        -------------------------------------------
        Chromium defaults to LCD subpixel rendering, which fakes resolution by
        tinting edge pixels red and cyan — invisible on a screen, but baked
        into a PNG it is an icon with orange and blue fringes down every
        stroke, still there when it is composited on a background it was not
        drawn against. This hint is ignored by some Linux builds, and the
        rendered-at-16px comparison showed it plainly. What actually removes
        the fringing is the downscale below: at 1024 the tinted pixels are a
        thousandth of a glyph and the reduction averages them away.
      */
      -webkit-font-smoothing: antialiased;
    }
    .n{transform:translateY(${-(size * 0.015).toFixed(2)}px)}
  </style><div class="tile"><span class="n">24</span></div>`;
}

/**
 * Shrink the master rather than re-rasterising the type.
 *
 * A 16px icon drawn directly is 9px type, and at 9px a font hinter has almost
 * nothing to work with — the counters fill in and "24" becomes two grey
 * smudges. Drawing it once at 1024 and letting Chromium's image scaler do the
 * reduction keeps the stroke weights proportional and the shapes readable,
 * which is the same reason a designer exports a favicon from a large artboard
 * instead of drawing one in a 16×16 grid.
 */
function shrink(master: string, size: number) {
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent}
    img{display:block;width:${size}px;height:${size}px}
  </style><img src="data:image/png;base64,${master}">`;
}

/** PNG-in-ICO. Every browser since IE11 reads it, and it avoids a BMP encoder. */
function ico(images: { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach((image, index) => {
    const at = index * 16;
    // 256 is stored as 0. Nothing here is that big, but the format says so.
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, at);
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, at + 1);
    directory.writeUInt8(0, at + 2); // palette entries
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(image.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += image.png.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.png)]);
}

async function main() {
  const executablePath = globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome").sort().at(-1);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});

  const shoot = async (size: number, html: string) => {
    const context = await browser.newContext({
      viewport: { width: size, height: size },
      // Exactly 1×. A device pixel ratio would hand back an image at a
      // different size than the one asked for, which the ICO directory then
      // lies about.
      deviceScaleFactor: 1,
    });
    const tab = await context.newPage();
    await tab.setContent(html);
    const png = await tab.screenshot({ omitBackground: true, type: "png" });
    await context.close();
    return { size, png };
  };

  // One master, drawn big, then reduced. See `shrink`.
  const MASTER = 1024;
  const master = (await shoot(MASTER, page(MASTER))).png.toString("base64");

  const [small, medium, large, apple, full] = await Promise.all(
    [16, 32, 48, 180, 512].map((size) => shoot(size, shrink(master, size))),
  );

  writeFileSync(new URL("../app/favicon.ico", import.meta.url), ico([small!, medium!, large!]));
  writeFileSync(new URL("../app/icon.png", import.meta.url), full!.png);
  writeFileSync(new URL("../app/apple-icon.png", import.meta.url), apple!.png);

  await browser.close();
  console.log("wrote app/favicon.ico (16/32/48), app/icon.png (512), app/apple-icon.png (180)");
}

void main();
