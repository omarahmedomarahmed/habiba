import type { TicketTopic } from "@/lib/db/schema";

/**
 * 🔴 Board 590 (AD17.1): WHICH QUEUE A CONTACT-FORM MESSAGE GOES TO.
 *
 * The public form never said, so every message landed in Patients, including
 * a partner developer asking about production approval. The second queue is
 * the professionals' queue: clinicians, practices, companies and partners.
 * A message goes there when its topic is theirs, or when its sender is one of
 * them whatever topic they chose. Two queues are kept (the column's CHECK
 * allows two); the words on the tab say who the second one is for.
 */
const PROFESSIONAL_TOPICS: readonly TicketTopic[] = ["joining_as_a_therapist", "a_partnership", "a_company"];

export function ticketAudience(topic: TicketTopic, fromProfessional: boolean): "patient" | "therapist" {
  return fromProfessional || PROFESSIONAL_TOPICS.includes(topic) ? "therapist" : "patient";
}
