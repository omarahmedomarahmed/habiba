import type { MetadataRoute } from "next";

/**
 * The web app manifest. PLAN.md 25.6, C116.
 *
 * ## 🔴 Why this exists rather than an App Store badge
 *
 * There is no iOS app and no Android app. A badge for software nobody can
 * install is a false claim on a live page, and this product's whole argument
 * to a patient is that it says true things about itself.
 *
 * What a patient can actually do is add this to their home screen, where it
 * opens without a browser bar and behaves like an app. That is what a manifest
 * is for, it costs one file, and it is honest.
 *
 * `start_url` is the patient's own home rather than the marketing site: the
 * person installing this is a patient, and landing them on a page selling the
 * product to therapists would be a strange greeting.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "24Therapy",
    short_name: "24Therapy",
    description:
      "Your sessions, your notes and the people you have given access to. Yours, and it travels with you.",
    start_url: "/patient",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0A2342",
    orientation: "portrait",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
