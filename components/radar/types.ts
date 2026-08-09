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
  rateCents: number;
  status: "online" | "pending" | "in_session";
  /**
   * True when the pending state is this visitor's own reservation — the
   * difference between "someone is booking them" and "you are booking them".
   * Getting this wrong locked patients out of bookings they had started.
   */
  reservedByYou: boolean;
};
