# The redesign: research and the system every sample follows

Written 2026-09-23 for the founder's brief: redesign the website, the app and every portal to be
visually stunning, alive, interactive, with micro-animations and a brilliant visual hierarchy;
one consistent visual language across all of them; the brand's colours and professionalism kept;
at least one full flow per user type and a homepage, all on `24therapy.app/design`, live.

## What the research says (and what we take from it)

| Finding | Source | What we do with it |
|---|---|---|
| People open a therapy app anxious. The home surfaces one recommended next thing, not a menu. | Headspace case studies ([blakecrosley.com](https://blakecrosley.com/guides/design/headspace), [raw.studio](https://raw.studio/blog/how-headspace-designs-for-mindfulness/)) | Every home screen has one hero with one primary action; everything else is secondary rails |
| Trauma-informed design: no triggering words, no scolding. "Streaks are out, nudges are in." | [simpalm 2026](https://www.simpalm.com/blog/mental-health-app-development-guide), [gapsystudio](https://gapsystudio.com/blog/mental-health-app-design/) | No streaks, no red for anything but SOS, copy that invites rather than warns |
| Motion must carry meaning; healthcare products fail when hints become fuss. | [better.care](https://www.better.care/blog-en/using-animation-and-motion-to-improve-usability-and-user-experience-in-healthcare-applications/), [acodez 2026](https://acodez.in/micro-interactions-motion-design/) | Motion answers "what changed, where did it go, what can I touch". Nothing loops except live indicators |
| Springs for anything touched; `prefers-reduced-motion` means fades, not nothing. | [bettermockups](https://www.bettermockups.com/blogs/resources/motion-design-principles), [superfiles](https://superfiles.in/motion-design-principles-for-ui.php) | One motion config for the whole design: spring presets, and `reducedMotion="user"` everywhere |
| Accessibility for cognitive, visual and motor limits is part of healthcare UX. | [ux.healthcare](https://ux.healthcare/mental-health-app-design-how-ux-shapes-better-digital-care/) | 44px targets, 14px floor, navy ink on teal, focus rings on every control |

## The visual language, one for every surface

- **Ground and ink: navy.** `navy-900` night ground for heroes and the live room; `navy-50` day ground
  for work surfaces. Ink is navy, never grey below navy-400.
- **One accent: the mark's teal (`brand-500`)**, with navy ink on it. It means "press this" or "live".
- **Glow, not gradient noise.** A soft teal radial glow behind the one thing that matters on a screen.
- **Glass for floating layers** (sheets, top bars over imagery): white at 80% with a blur.
- **Signals:** amber = money owed, red = SOS only, teal pulse = live now.
- **Shape:** 24px radius for cards, 999 for chips, 16 for inputs.
- **Motion vocabulary (the same everywhere):**
  - enter: rise 12px + fade, staggered 40ms;
  - press: scale 0.97 spring;
  - select: a shared-layout pill slides to the chosen chip or tab;
  - numbers count up to their value;
  - live: a teal ring pulse, the only loop;
  - sheets: spring up from the bottom, dimming what is behind, never over SOS.

## One flow per user type

| Surface | The flow drawn | Why this flow |
|---|---|---|
| Website | Homepage: live radar globe (three.js), audience switch, how it works, the price truth, the four promises | The first thing everyone sees |
| Patient (mobile app) | Home → search and filter → therapist → book with the real share → consent → live session → summary | The founder's first priority and P1 |
| Therapist | Today → live session with streaming transcript and copilot → draft note → sign | T1, T2, T5 |
| Clinic | Overview → add a clinician with a seat quote → the practice bill | C1 to C5, no patient names |
| Company | Overview → change coverage with a live preview → people → top up | E1 to E5, nothing per person |
| Console | The stuck list by age → match a bank transfer → confirm once | A1 to A5 |
| Partner | Connect → keys → usage → webhooks | Last, per the brief |

## Honesty rules that survive the visual push

- Sample data is the demo cast; no invented testimonials, ratings or company statistics.
- Every price is the real share after cover and VAT.
- The clinic never sees a patient name; the company never sees who, when or what.
- SOS is in the bottom bar of the app, on every screen, and nothing covers it.
