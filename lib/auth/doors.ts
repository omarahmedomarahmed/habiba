import type { Translate } from "@/lib/i18n/server";
import { CLINIC_APPLY, CLINIC_SIGN_IN, SPONSOR_APPLY, SPONSOR_SIGN_IN } from "@/lib/routing";

/**
 * The four doors a person can let themselves through. Tasks 153, 154.
 *
 * ## Why this is a plain module and not part of the menu component
 *
 * Both the header's dropdown, which is a client component, and the auth
 * shell's switcher, which is a server component, need the same list. A
 * function exported from a `"use client"` file cannot be *called* by server
 * code: the boundary turns it into a reference the client resolves. So the
 * list lives here, where both sides can read it, and neither can drift.
 *
 * ## Why four and not six
 *
 * Six principals have doors. Partners and staff are real but nobody self
 * serves them: a partner is onboarded by us, a staff member is seeded. Offering
 * either in a marketing header reads as a product with a back door, so they get
 * a quiet line at the bottom instead of a card.
 *
 * ## The two that cannot sign themselves up
 *
 * 🔴 There is no `/sponsor/signup` and no `/clinic/signup`. An organisation
 * account is created from an enquiry, which is deliberate and recorded on
 * `/sponsor/sign-in`. The signup variant therefore points at `SPONSOR_APPLY`
 * and `CLINIC_APPLY` and the wording says what will happen. Naming the two
 * routes that would be symmetrical would have published two 404s reachable
 * from the header of every page on the site.
 *
 * Every path comes from `lib/routing.ts`, which is the one table that decides
 * which door a path belongs to, so a door cannot be moved without this moving
 * with it.
 */

export type DoorKey = "therapist" | "patient" | "company" | "clinic";

export type Door = {
  key: DoorKey;
  href: string;
  label: string;
  /** One line, from the reader's side, saying what is behind this door. */
  why: string;
};

export function doors(t: Translate, kind: "signin" | "signup"): Door[] {
  const up = kind === "signup";
  return [
    {
      key: "therapist",
      href: up ? "/signup" : "/login",
      label: t("nav.signInAs.therapist"),
      why: t("nav.signInAs.therapistWhy"),
    },
    {
      key: "patient",
      href: up ? "/patient/signup" : "/patient/login",
      label: t("nav.signInAs.patient"),
      why: t("nav.signInAs.patientWhy"),
    },
    {
      key: "company",
      href: up ? SPONSOR_APPLY : SPONSOR_SIGN_IN,
      label: t("nav.signInAs.company"),
      why: up ? t("nav.applyAs.company") : t("nav.signInAs.companyWhy"),
    },
    {
      key: "clinic",
      href: up ? CLINIC_APPLY : CLINIC_SIGN_IN,
      label: t("nav.signInAs.clinic"),
      why: up ? t("nav.applyAs.clinic") : t("nav.signInAs.clinicWhy"),
    },
  ];
}

/** The opposite page for one door: sign in from signup, and back. */
export function otherWay(who: DoorKey, kind: "signin" | "signup", t: Translate): Door {
  const other = doors(t, kind === "signin" ? "signup" : "signin");
  return other.find((door) => door.key === who) ?? other[0];
}
