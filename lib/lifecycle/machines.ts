/**
 * Every lifecycle in the product, as states and arrows, checkable.
 *
 * ## What this is for, and why it is not a diagram
 *
 * "Walk every edge case" is not a thing you can do by walking. A crawler goes
 * where you point it and a simulation goes where its agents go; neither can
 * visit a state that nothing leads to, and neither notices a state that
 * nothing leaves. An edge case is a MISSING ARROW, and the only way to see a
 * missing arrow is to write down the ones that exist.
 *
 * So each entity that has a lifecycle is declared here, and
 * `scripts/verify-machines.ts` asserts three properties over all of them:
 *
 *   every state has a screen that names it        a "pending" nobody explains
 *   every transition has a trigger and an actor   a state nothing can leave
 *   every stopped person has a way out            a rejection that ends there
 *
 * The third is the whole "never stuck" problem, stated as arithmetic, and the
 * sharpest form of it is the one the gate derives rather than reads: a state
 * where the person is stopped and every arrow out belongs to US. That is not
 * a bug, it is a service commitment, and it has to carry a stated length.
 *
 * ## 🔴 THE STATES ARE ANCHORED TO THE SCHEMA, NOT RETYPED
 *
 * A state machine written in a document is wrong the week after it is written,
 * in exactly the way a hand typed route list is. Each machine carries the real
 * constant from `lib/db/schema.ts` as its `anchor`, and the gate fails if the
 * declared states and the anchor disagree in either direction. Add a status to
 * the schema and this file has to say what it means; delete one and this file
 * has to stop claiming it.
 *
 * Transitions have no such anchor, because the schema does not record them.
 * They are a claim about the product, which is why they carry an actor: a
 * transition nobody can perform is a lie that reads as a design.
 */
import {
  CLAIM_STATUSES,
  GRANT_STATUSES,
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  RADAR_STATUSES,
  RENEWAL_STATES,
  SESSION_STATUSES,
  SLOT_STATES,
  SPONSOR_STATES,
  VERIFICATION_STATES,
} from "../db/schema";

/**
 * 🔴 WHO MOVES IT, because "it becomes overdue" hides whether anything does.
 *
 * `time` is a real actor and the most commonly forgotten one: a state that only
 * a clock can leave needs a clock that actually runs, and `app/api/cron` is
 * where that is proved. `system` is our code reacting to something else, such
 * as a webhook. The rest are people.
 */
export type Actor =
  | "patient"
  | "clinician"
  | "clinic"
  | "company"
  | "staff"
  | "system"
  | "time";

export type Transition = {
  from: string;
  to: string;
  /** What happens, in the words of the person or clock that does it. */
  trigger: string;
  by: Actor;
};

/**
 * 🔴 FIVE WORDS, BECAUSE TWO WERE HIDING THE CASE THAT MATTERS.
 *
 * This started as `success` and `dead-end`, and the gate caught eleven states
 * that were neither. Two separate questions had been collapsed into one word:
 * can the thing still move, and is the person stopped. They are independent,
 * and the pair nobody had a name for is the whole point of the exercise.
 *
 *   working   in flight, nobody is stopped
 *   resting   fine to sit in forever, and things may still happen from here
 *   success   good, and finished; no arrow leaves it
 *   blocked   THE PERSON IS STOPPED AND THE ROW CAN STILL MOVE
 *   dead-end  the person is stopped and this row is finished; the exit is a
 *             fresh one, which is a real answer and not a shrug
 *
 * `blocked` is the register. A blocked state whose every way out is OURS is a
 * person who cannot help themselves, so the gate makes those carry a promise.
 *
 * It is required rather than optional so that a new state cannot be added
 * without somebody deciding which of the five it is. A default would decide
 * for them, and it would decide wrong in the quiet direction.
 */
export type Kind = "working" | "resting" | "success" | "blocked" | "dead-end";

export type StateSpec = {
  /** Where a person sees this state. The inventory can confirm it exists. */
  screen: string;
  kind: Kind;
  /** What the stopped person can DO. Required on `blocked` and `dead-end`. */
  exit?: string;
  /**
   * 🔴 How long this state may last before somebody must act. Only on states
   * where a person is WAITING on us or on another party. Feeds the clock in
   * task #166: an alert fires on the age of the oldest one, never the count.
   */
  promise?: string;
};

export type Machine = {
  key: string;
  /** The table this lives on, so a reader can go and look. */
  entity: string;
  /** 🔴 The schema constant. Drift in either direction is a failure. */
  anchor: readonly string[];
  initial: string;
  states: Record<string, StateSpec>;
  transitions: Transition[];
};

/* ====================================================================== */
/*  Money owed to a clinician                                             */
/* ====================================================================== */

/**
 * 🔴 DECIDED: the therapist holds their own details and asks; the clinic may
 * endorse; after three days it reaches us anyway.
 *
 * What exists today is the `anchor` below and nothing else. `approvePayout` is
 * called only from the admin actions with a staff `approverUserId`, so
 * `approved` means WE approved it, and the clinic has no step at all: its
 * earnings page does not mention payouts.
 *
 * The decision needs one more state between `requested` and `approved`, and it
 * is NOT a flag on the existing row. Three parties act on a payout and each
 * needs its own record: the therapist asked, the clinic endorsed or did not,
 * we approved. A column that means two of those is the shape that produces a
 * queue nobody can read.
 *
 * 🔴 ESCALATION IS NOT APPROVAL. The three day arrow moves it into our queue.
 * It does not pay. Anything that pays on a timer is a defect.
 *
 * The transitions below describe TODAY, so the gate measures today. The
 * endorsement state lands with the work, and this comment is the specification
 * for it.
 */
const payout: Machine = {
  key: "payout",
  entity: "payout_requests",
  anchor: PAYOUT_STATUSES,
  initial: "requested",
  states: {
    requested: {
      screen: "/earnings, and /admin/payouts",
      kind: "working",
      promise: "3 days before it reaches us with or without the clinic",
    },
    approved: { screen: "/admin/payouts", kind: "working", promise: "2 days to send" },
    sent: { screen: "/earnings", kind: "working", promise: "5 days to land" },
    confirmed: { screen: "/earnings", kind: "success" },
    rejected: {
      screen: "/earnings",
      kind: "dead-end",
      exit: "the reason is shown and a corrected request can be made",
    },
    /* W2-A04: the ledger post is reversed, so the money can be asked for again. */
    returned: {
      screen: "/earnings",
      kind: "dead-end",
      exit: "the reason is shown, the balance is back, and a new request can be made",
    },
  },
  transitions: [
    { from: "requested", to: "approved", trigger: "staff approves", by: "staff" },
    { from: "requested", to: "rejected", trigger: "staff rejects with a reason", by: "staff" },
    { from: "approved", to: "sent", trigger: "staff marks the transfer made", by: "staff" },
    { from: "sent", to: "confirmed", trigger: "the clinician confirms receipt", by: "clinician" },
    { from: "sent", to: "returned", trigger: "staff mark that it did not arrive", by: "staff" },
  ],
};

/* ====================================================================== */
/*  The hour itself                                                       */
/* ====================================================================== */

const session: Machine = {
  key: "session",
  entity: "sessions",
  anchor: SESSION_STATUSES,
  initial: "scheduled",
  states: {
    scheduled: {
      screen: "/patient/sessions and /sessions",
      kind: "working",
      promise: "until it starts",
    },
    in_progress: { screen: "the room", kind: "working" },
    completed: { screen: "/patient/sessions and /notes", kind: "success" },
    cancelled: {
      screen: "/patient/sessions",
      kind: "dead-end",
      exit: "rebook from the same screen",
    },
  },
  transitions: [
    { from: "scheduled", to: "in_progress", trigger: "somebody joins", by: "clinician" },
    { from: "scheduled", to: "cancelled", trigger: "either side cancels", by: "patient" },
    { from: "in_progress", to: "completed", trigger: "the room ends", by: "clinician" },
    { from: "in_progress", to: "cancelled", trigger: "abandoned", by: "time" },
  ],
};

/* ====================================================================== */
/*  What somebody owes                                                    */
/* ====================================================================== */

/**
 * 🔴 `waived` AND `included` LOOK LIKE THE SAME THING AND ARE NOT.
 *
 * `included` is covered by something the payer already bought: their credit,
 * their seat, their plan. `waived` is us deciding not to charge. Both are zero
 * on the bill and only one is a commercial decision, which is why they are two
 * states and not one.
 */
const invoice: Machine = {
  key: "invoice",
  entity: "invoices",
  anchor: INVOICE_STATUSES,
  initial: "due",
  states: {
    due: {
      screen: "/billing",
      kind: "working",
      promise: "the allowance before service is interrupted",
    },
    paid: { screen: "/billing", kind: "success" },
    included: { screen: "/billing", kind: "success" },
    waived: { screen: "/billing", kind: "success" },
    void: { screen: "/billing", kind: "success" },
    failed: {
      screen: "/billing",
      kind: "blocked",
      exit: "the reason is shown and the payment can be retried",
      promise: "until the allowance runs out",
    },
  },
  transitions: [
    { from: "due", to: "paid", trigger: "the payer pays", by: "clinician" },
    { from: "due", to: "failed", trigger: "the charge is refused", by: "system" },
    { from: "due", to: "waived", trigger: "staff waives it", by: "staff" },
    { from: "due", to: "void", trigger: "staff voids it", by: "staff" },
    { from: "due", to: "included", trigger: "credit or a seat covers it", by: "system" },
    { from: "failed", to: "paid", trigger: "the payer pays another way", by: "clinician" },
    { from: "failed", to: "void", trigger: "staff voids it", by: "staff" },
  ],
};

/* ====================================================================== */
/*  Money arriving                                                        */
/* ====================================================================== */

const payment: Machine = {
  key: "payment",
  entity: "payments",
  anchor: PAYMENT_STATUSES,
  initial: "pending",
  states: {
    pending: {
      screen: "the bar that follows an unfinished payment around the product",
      kind: "working",
      promise: "hours, and the bar says so",
    },
    paid: { screen: "the same bar, green", kind: "resting" },
    refunded: { screen: "/billing", kind: "success" },
    failed: {
      screen: "/billing",
      kind: "dead-end",
      exit: "the reason is shown and another attempt can be made",
    },
  },
  transitions: [
    { from: "pending", to: "paid", trigger: "an operator confirms the transfer", by: "staff" },
    { from: "pending", to: "failed", trigger: "an operator rejects the proof", by: "staff" },
    { from: "paid", to: "refunded", trigger: "staff refunds", by: "staff" },
  ],
};

/* ====================================================================== */
/*  Being allowed to practise                                             */
/* ====================================================================== */

const verification: Machine = {
  key: "verification",
  entity: "therapist_verifications",
  anchor: VERIFICATION_STATES,
  initial: "draft",
  states: {
    draft: { screen: "/onboarding", kind: "working" },
    submitted: { screen: "/onboarding", kind: "working", promise: "2 working days" },
    approved: { screen: "/dashboard", kind: "success" },
    rejected: {
      screen: "/onboarding",
      kind: "blocked",
      exit: "the reason is shown and fresh documents can be sent",
    },
  },
  transitions: [
    { from: "draft", to: "submitted", trigger: "documents sent", by: "clinician" },
    { from: "submitted", to: "approved", trigger: "staff approves", by: "staff" },
    { from: "submitted", to: "rejected", trigger: "staff rejects with a reason", by: "staff" },
    { from: "rejected", to: "submitted", trigger: "fresh documents sent", by: "clinician" },
  ],
};

/* ====================================================================== */
/*  A patient claiming a record, and an employer covering them            */
/* ====================================================================== */

const claim: Machine = {
  key: "claim",
  entity: "patient_claims",
  anchor: CLAIM_STATUSES,
  initial: "pending",
  states: {
    pending: { screen: "/patient/claim", kind: "working", promise: "the life of the link" },
    verified: { screen: "/patient", kind: "success" },
    rejected: {
      screen: "/patient/claim",
      kind: "dead-end",
      exit: "the reason is shown and the clinician can send a fresh link",
    },
    expired: {
      screen: "/patient/claim",
      kind: "dead-end",
      exit: "ask the clinician for a new link, from that screen",
    },
    locked: {
      screen: "/patient/claim",
      kind: "blocked",
      exit: "too many attempts; it unlocks on its own and says when",
      promise: "the lockout window",
    },
  },
  transitions: [
    { from: "pending", to: "verified", trigger: "the patient proves the code", by: "patient" },
    { from: "pending", to: "rejected", trigger: "the clinician withdraws it", by: "clinician" },
    { from: "pending", to: "expired", trigger: "the link ages out", by: "time" },
    { from: "pending", to: "locked", trigger: "too many wrong codes", by: "system" },
    { from: "locked", to: "pending", trigger: "the lockout ends", by: "time" },
  ],
};

const grant: Machine = {
  key: "grant",
  entity: "benefit_grants",
  anchor: GRANT_STATUSES,
  initial: "pending",
  states: {
    pending: { screen: "/patient/benefit", kind: "working", promise: "until the employer answers" },
    granted: { screen: "/patient/benefit", kind: "resting" },
    rejected: {
      screen: "/patient/benefit",
      kind: "dead-end",
      exit: "the employer's reason is shown, and the patient can still pay for themselves",
    },
    revoked: {
      screen: "/patient/benefit",
      kind: "dead-end",
      exit: "cover has ended; the patient can still pay for themselves",
    },
  },
  transitions: [
    { from: "pending", to: "granted", trigger: "the employer approves", by: "company" },
    { from: "pending", to: "rejected", trigger: "the employer refuses", by: "company" },
    { from: "granted", to: "revoked", trigger: "the employer ends cover", by: "company" },
  ],
};

/* ====================================================================== */
/*  An employer's account and its money                                   */
/* ====================================================================== */

const sponsor: Machine = {
  key: "sponsor",
  entity: "sponsors",
  anchor: SPONSOR_STATES,
  initial: "held",
  states: {
    held: {
      screen: "the company portal, with every page saying what is waiting",
      kind: "working",
      promise: "until we have called them",
    },
    active: { screen: "/sponsor", kind: "resting" },
    /*
     * 🔴 THE GATE FOUND THIS ONE, AND IT IS THE WHOLE POINT OF THE GATE.
     *
     * A suspended company is stopped, and the ONLY arrow out is staff restoring
     * them. They cannot try harder, pay something, or send a document: they can
     * only wait on us. It read as fine for as long as it was filed next to
     * `closed` under one word, and the split made it the only `blocked` state
     * in the product with no answer to "for how long".
     *
     * The promise below is a commitment, not a description: it is now something
     * the round-the-clock desk has to meet, and #166 is what notices when a
     * suspended company ages past it.
     */
    suspended: {
      screen: "/sponsor",
      kind: "blocked",
      exit: "the reason is shown, with who to contact, and staff can restore it",
      promise: "1 working day to a decision, either way",
    },
    closed: { screen: "/sponsor", kind: "success" },
  },
  transitions: [
    { from: "held", to: "active", trigger: "staff approve after speaking to them", by: "staff" },
    { from: "active", to: "suspended", trigger: "staff suspend", by: "staff" },
    { from: "suspended", to: "active", trigger: "staff restore", by: "staff" },
    { from: "active", to: "closed", trigger: "the company closes the account", by: "company" },
  ],
};

const renewal: Machine = {
  key: "renewal",
  entity: "subscription_renewals",
  anchor: RENEWAL_STATES,
  initial: "due",
  states: {
    due: {
      screen: "/billing",
      kind: "working",
      promise: "the allowance before service is interrupted",
    },
    paid: { screen: "/billing", kind: "success" },
    void: { screen: "/billing", kind: "success" },
    lapsed: {
      screen: "/billing",
      kind: "blocked",
      exit: "the plan drops to pay as you go and the screen says so",
    },
  },
  transitions: [
    { from: "due", to: "paid", trigger: "the payer pays", by: "clinician" },
    { from: "due", to: "lapsed", trigger: "the allowance runs out", by: "time" },
    { from: "due", to: "void", trigger: "staff void it", by: "staff" },
    { from: "lapsed", to: "paid", trigger: "the payer pays late", by: "clinician" },
  ],
};

/* ====================================================================== */
/*  Being findable, and an hour being held                                */
/* ====================================================================== */

const presence: Machine = {
  key: "presence",
  entity: "therapist_radar",
  anchor: RADAR_STATUSES,
  initial: "offline",
  states: {
    offline: { screen: "/dashboard", kind: "resting" },
    online: { screen: "the radar, and /dashboard", kind: "working" },
    pending: {
      screen: "/dashboard",
      kind: "working",
      promise: "minutes, before the hold is released",
    },
    in_session: { screen: "the room", kind: "working" },
  },
  transitions: [
    { from: "offline", to: "online", trigger: "the clinician goes on the radar", by: "clinician" },
    { from: "online", to: "offline", trigger: "the clinician leaves it", by: "clinician" },
    { from: "online", to: "pending", trigger: "a patient asks for them", by: "patient" },
    { from: "pending", to: "in_session", trigger: "the clinician accepts", by: "clinician" },
    { from: "pending", to: "online", trigger: "the hold is not taken up", by: "time" },
    { from: "in_session", to: "online", trigger: "the session ends", by: "clinician" },
    { from: "online", to: "offline", trigger: "the sweep finds them gone", by: "time" },
  ],
};

const slot: Machine = {
  key: "slot",
  entity: "availability_slots",
  anchor: SLOT_STATES,
  initial: "open",
  states: {
    open: { screen: "the clinician's calendar and the booking sheet", kind: "working" },
    held: {
      screen: "the booking sheet",
      kind: "working",
      promise: "minutes, while a payment is finished",
    },
    booked: { screen: "both calendars", kind: "resting" },
    blocked: { screen: "the clinician's calendar", kind: "resting" },
  },
  transitions: [
    { from: "open", to: "held", trigger: "a patient starts booking", by: "patient" },
    { from: "held", to: "booked", trigger: "the payment completes", by: "patient" },
    { from: "held", to: "open", trigger: "the hold expires", by: "time" },
    { from: "open", to: "blocked", trigger: "the clinician blocks the hour", by: "clinician" },
    { from: "blocked", to: "open", trigger: "the clinician frees it", by: "clinician" },
    { from: "booked", to: "open", trigger: "the session is cancelled", by: "patient" },
  ],
};

export const MACHINES: Machine[] = [
  payout,
  session,
  invoice,
  payment,
  verification,
  claim,
  grant,
  sponsor,
  renewal,
  presence,
  slot,
];
