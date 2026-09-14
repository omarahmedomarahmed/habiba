/**
 * The public shape of a clinician on the radar.
 *
 * Everything here is what the clinician chose to publish about themselves. It
 * is served to anonymous visitors, so anything that is not their own shopfront
 * — email, organisation, anything patient-shaped — must never be added to it.
 */
export type RadarEntry = {
  userId: string;
  firstName: string;
  lastName: string | null;
  credentials: string | null;
  headline: string | null;
  photoUrl: string | null;
  languages: string[];
  specialties: string[];
  country: string | null;
  region: string | null;
  city: string | null;
  /**
   * A door a patient may actually walk through.
   *
   * Null unless the clinician both confirmed the pin and switched walk-ins on.
   * An unconfirmed address is worse than no address — it sends someone in
   * distress to a building that may not be there.
   */
  practice: {
    name: string | null;
    address: string;
    lat: string | null;
    lon: string | null;
  } | null;
  /**
   * 🔴 63.13 / C327 / C354 — THE PRACTICE THAT CAN SEE AN APPOINTMENT EXISTS.
   *
   * Null for a clinician who works on their own, which is most of them and is the
   * case where there is no administrative staff at all: there is nobody at that
   * practice but the person the patient chose.
   *
   * Set for a clinic-attached clinician, and the card carries a small persistent
   * label. C354 rules out the obvious alternative in as many words: *a disclosure
   * wall in front of somebody in crisis is the wrong trade.* So this is a label
   * beside the name rather than a dialog, and the full sentence is on the patient's
   * own record page, always available.
   *
   * 🔴 It is the practice's NAME, which is already on the clinician's public
   * profile before anybody books. Nothing here is new information about the
   * clinician; what is new is the patient being told what it means for them.
   */
  clinicName: string | null;
  sessionRateCents: number;
  /** Null until enough sessions have been rated for a number to mean anything. */
  rating: { average: number; count: number } | null;
  status: "online" | "pending" | "in_session";
  /**
   * True when the pending state is this visitor's own reservation — the
   * difference between "someone is booking them" and "you are booking them".
   * Getting this wrong locked patients out of bookings they had started.
   */
  reservedByYou: boolean;
};
