/**
 * 🔴 W3: THE CRASH PAGE'S OWN WORDS, IN BOTH LANGUAGES AT ONCE.
 *
 * `app/global-error.tsx` replaces the root layout, so no dictionary provider
 * and no request exist when it renders, and 45.7 forbids a component reading
 * `messages.ts` as a value. It cannot know the reader's language, so it says
 * everything in both, the way `LAST_RESORT_HELP` already does for the numbers.
 */
export const LAST_RESORT_ERROR = {
  title: { en: "Something went wrong", ar: "حدث خطأ ما" },
  body: {
    en: "The page could not be displayed. Nothing was lost.",
    ar: "تعذّر عرض الصفحة، ولم يضِع شيء.",
  },
  retry: { en: "Try again", ar: "حاول مرة أخرى" },
} as const;
