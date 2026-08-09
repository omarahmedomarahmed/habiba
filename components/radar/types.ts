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
  rateCents: number;
  status: "online" | "pending" | "in_session";
  /**
   * True when the pending state is this visitor's own reservation — the
   * difference between "someone is booking them" and "you are booking them".
   * Getting this wrong locked patients out of bookings they had started.
   */
  reservedByYou: boolean;
};
