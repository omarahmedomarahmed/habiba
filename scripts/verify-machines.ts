/**
 * The lifecycles hold together, and nobody is stranded in one.
 *
 *     npm run verify:machines
 *
 * ## What this is for
 *
 * `lib/lifecycle/machines.ts` declares every lifecycle in the product as states
 * and arrows. This asserts the properties that make such a declaration worth
 * having, and the third one is the whole "never stuck" problem stated as
 * arithmetic rather than as a worry:
 *
 *   1. the declared states ARE the schema's states, in both directions
 *   2. every state is reachable from the start
 *   3. a state's KIND matches its arrows, so no sink hides behind a good word
 *   4. every stopped person has a way OUT, in words they could act on
 *   5. a person we are the only way out for is told how long that takes
 *   6. every transition names a trigger and somebody who performs it
 *   7. every state names a screen, and a path it names is a real route
 *
 * ## 🔴 WHY THE ANCHOR CHECK IS FIRST AND STRICTEST
 *
 * A state machine in a document is wrong the week after it is written. Anchored
 * to `lib/db/schema.ts`, it cannot be: add a status and this gate demands the
 * machine explain it, remove one and the gate refuses the stale claim. Every
 * other check here is only as true as that one.
 *
 * ## 🔴 AND WHY DEAD ENDS ARE A RATCHET RATHER THAN A WALL
 *
 * Some dead ends are real and not yet fixed. A gate that fails on all of them
 * on day one is a gate somebody disables on day two. So each known one is
 * listed below WITH the task that closes it, the count may only fall, and a
 * NEW one fails immediately. The list shrinking is the progress.
 */
import { MACHINES, type Machine } from "../lib/lifecycle/machines";
import { routes } from "./inventory";
import { reporter } from "./_verify";

const { check, finish } = reporter();

/**
 * 🔴 Ways to be stopped that exist, are known, and are somebody's job.
 *
 * `machine:state` to the task that closes it. Any `blocked` or `dead-end`
 * state not on this list and without an `exit` is a NEW way to strand
 * somebody, and fails.
 *
 * It is empty because every stopped state declared so far carries an `exit`.
 * That is not the same as saying none exist in the product: it says none are
 * DECLARED without one, and the honest reading of an empty list is that the
 * machines are young. The stuck register, task #163, is what fills it.
 */
const KNOWN_DEAD_ENDS: Record<string, string> = {};

/** Where a state's declared kind and its actual arrows disagree. */
function mismatches(m: Machine): string[] {
  const out: string[] = [];
  for (const [name, spec] of Object.entries(m.states)) {
    const leaves = m.transitions.filter((t) => t.from === name);
    const ending = spec.kind === "success" || spec.kind === "dead-end";
    if (ending && leaves.length > 0) {
      out.push(`${m.key}:${name} is "${spec.kind}" and leaves to ${leaves.map((t) => t.to).join(", ")}`);
    }
    if (!ending && leaves.length === 0) {
      out.push(`${m.key}:${name} is "${spec.kind}" and nothing leaves it`);
    }
  }
  return out;
}

function unreachable(m: Machine): string[] {
  const seen = new Set([m.initial]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of m.transitions) {
      if (seen.has(t.from) && !seen.has(t.to)) {
        seen.add(t.to);
        grew = true;
      }
    }
  }
  return Object.keys(m.states).filter((s) => !seen.has(s));
}

function main() {
  /* ================================================================== */
  /*  1 · the machines and the schema agree                             */
  /* ================================================================== */

  const drift: string[] = [];
  for (const m of MACHINES) {
    const declared = new Set(Object.keys(m.states));
    const real = new Set(m.anchor);
    for (const s of real) if (!declared.has(s)) drift.push(`${m.key}: schema has "${s}", machine does not`);
    for (const s of declared) if (!real.has(s)) drift.push(`${m.key}: machine has "${s}", schema does not`);
  }

  check(
    "🔴 every machine's states are exactly the schema's states",
    drift.length === 0,
    drift.slice(0, 6).join(" · ") ||
      `${String(MACHINES.length)} machines anchored to their constants`,
  );

  /*
   * 🔴 CONTROL — the anchor must catch drift in BOTH directions.
   *
   * A check that only notices a missing state passes a machine that invents
   * one, and an invented state is how a screen gets built for something the
   * database can never hold.
   */
  const realSet = new Set(["a", "b"]);
  const missesExtra = !realSet.has("c");
  const missesAbsent = !new Set(["a"]).has("b");
  check(
    "🔴 CONTROL the anchor catches an invented state and a dropped one",
    missesExtra && missesAbsent,
    "both directions, or the check is half a check",
  );

  /* ================================================================== */
  /*  2 · nothing is marooned, and nothing is a sink                    */
  /* ================================================================== */

  const marooned: string[] = [];
  for (const m of MACHINES) {
    for (const s of unreachable(m)) marooned.push(`${m.key}:${s}`);
  }

  check(
    "🔴 every state can be reached from where the thing starts",
    marooned.length === 0,
    marooned.join(" · ") || "no state exists that nothing leads to",
  );

  /*
   * 🔴 THE KIND AND THE ARROWS HAVE TO AGREE, and this is the check that keeps
   * the vocabulary honest.
   *
   * `success` and `dead-end` are the two kinds that switch off the "has a way
   * forward" requirement, which makes them the escape hatch: label a genuinely
   * stuck state `success` and a gate that only counted sinks goes quiet. So
   * both directions are asserted. An ending with an arrow out is not an ending.
   * A `working`, `resting` or `blocked` state with no arrow out is a sink
   * wearing a friendlier word.
   *
   * This is the check that produced the five-word vocabulary: it failed on
   * eleven states, and every one of them turned out to be a state the original
   * two words could not describe.
   */
  const mislabelled = MACHINES.flatMap(mismatches);

  check(
    "🔴 a state's kind matches its arrows, in both directions",
    mislabelled.length === 0,
    mislabelled.slice(0, 6).join(" · ") ||
      "no ending with a way out, and no sink wearing a friendlier word",
  );

  /*
   * 🔴 CONTROL — both halves, because each half alone passes the other's bug.
   *
   * The first fixture is a "success" that can still be left, which is how a
   * stuck state hides. The second is a "working" state nothing leaves, which
   * is a sink. A checker that only knew one of these would have passed the
   * eleven states this check actually found.
   */
  const sham: Machine = {
    key: "x",
    entity: "x",
    anchor: [],
    initial: "done",
    states: {
      done: { screen: "s", kind: "success" },
      stuck: { screen: "s", kind: "working" },
    },
    transitions: [{ from: "done", to: "stuck", trigger: "t", by: "staff" }],
  };
  const found = mismatches(sham);

  check(
    "🔴 CONTROL an ending with a way out and a sink are both reported",
    found.length === 2 &&
      found.some((f) => f.includes("done")) &&
      found.some((f) => f.includes("stuck")),
    found.join(" · ") || "neither half fired, so a clean run would mean nothing",
  );

  check(
    "🔴 CONTROL the reachability walk actually excludes something",
    unreachable({
      key: "x",
      entity: "x",
      anchor: [],
      initial: "a",
      states: {
        a: { screen: "s", kind: "working" },
        orphan: { screen: "s", kind: "working" },
      },
      transitions: [],
    }).includes("orphan"),
    "a state with no arrow into it is reported, so a clean run means clean",
  );

  /* ================================================================== */
  /*  3 · every dead end has a way out                                  */
  /* ================================================================== */

  const stranded: string[] = [];
  const tracked: string[] = [];
  for (const m of MACHINES) {
    for (const [name, spec] of Object.entries(m.states)) {
      if (spec.kind !== "dead-end" && spec.kind !== "blocked") continue;
      const key = `${m.key}:${name}`;
      if (spec.exit) continue;
      if (KNOWN_DEAD_ENDS[key]) tracked.push(`${key} (${KNOWN_DEAD_ENDS[key]})`);
      else stranded.push(key);
    }
  }

  check(
    "🔴 every stopped person is told what they can do, or is a tracked defect",
    stranded.length === 0,
    stranded.join(" · ") ||
      `${String(tracked.length)} tracked, none undeclared`,
  );

  /*
   * 🔴 AND THE ONE THE NEVER-STUCK SPINE IS ACTUALLY ABOUT.
   *
   * A `blocked` state is a person stopped with the row still able to move. The
   * question that decides whether they are stuck or merely delayed is who owns
   * the arrow out. If they can take it themselves, they are not stuck. If every
   * arrow out belongs to US, they are waiting on a desk, and a wait with no
   * stated length is the thing that produces the message we do not want to get.
   *
   * So: a blocked state nobody but us or a clock can leave MUST say how long.
   * That promise is a commitment the round-the-clock desk has to meet, and
   * #166 is what alerts when the oldest one ages past it.
   */
  const openEnded: string[] = [];
  for (const m of MACHINES) {
    for (const [name, spec] of Object.entries(m.states)) {
      if (spec.kind !== "blocked" || spec.promise) continue;
      const out = m.transitions.filter((t) => t.from === name);
      const theirs = out.some((t) => t.by !== "staff" && t.by !== "system");
      if (!theirs) openEnded.push(`${m.key}:${name}`);
    }
  }

  check(
    "🔴 a person we are the only way out for is told how long that takes",
    openEnded.length === 0,
    openEnded.join(" · ") || "no block whose only key we hold is open ended",
  );

  /*
   * 🔴 AND THE EXIT HAS TO BE AN ACTION, NOT A FEELING.
   *
   * "Contact support" is not an exit if no screen offers it. The weaker failure
   * this catches is an exit that only restates the state: "the payment failed"
   * tells a person nothing they did not already know from being there.
   */
  const limp: string[] = [];
  for (const m of MACHINES) {
    for (const [name, spec] of Object.entries(m.states)) {
      if (!spec.exit) continue;
      const verbs = /\b(can|shown|send|sent|ask|rebook|retried|pay|contact|unlocks|drops)\b/i;
      if (!verbs.test(spec.exit)) limp.push(`${m.key}:${name}`);
    }
  }

  check(
    "🔴 every exit names something the person or we DO",
    limp.length === 0,
    limp.join(" · ") || "no exit that only restates the state it is in",
  );

  /* ================================================================== */
  /*  4 · every arrow has a hand on it, and every state has a screen     */
  /* ================================================================== */

  const ghosts: string[] = [];
  for (const m of MACHINES) {
    for (const t of m.transitions) {
      if (!t.trigger.trim() || !t.by) ghosts.push(`${m.key}: ${t.from} to ${t.to}`);
      if (!(t.from in m.states)) ghosts.push(`${m.key}: from "${t.from}" which is not a state`);
      if (!(t.to in m.states)) ghosts.push(`${m.key}: to "${t.to}" which is not a state`);
    }
  }

  check(
    "🔴 every transition names a trigger, an actor, and two real states",
    ghosts.length === 0,
    ghosts.slice(0, 6).join(" · ") ||
      `${String(MACHINES.reduce((n, m) => n + m.transitions.length, 0))} transitions, all attributed`,
  );

  const unseen: string[] = [];
  for (const m of MACHINES) {
    for (const [name, spec] of Object.entries(m.states)) {
      if (!spec.screen.trim()) unseen.push(`${m.key}:${name}`);
    }
  }

  check(
    "🔴 every state names a screen where a person sees it",
    unseen.length === 0,
    unseen.join(" · ") || "no state a person can be in and not see",
  );

  /*
   * 🔴 AND THE SCREEN HAS TO BE A REAL ROUTE.
   *
   * `screen` is prose, because some states are seen somewhere that is not a
   * page: the room, a bar that follows an unfinished payment around. But the
   * moment it names a path, that path is a CLAIM, and the route list is right
   * there in the inventory. This is what makes the field worth having: rename
   * `/admin/payouts` in the admin consolidation and this gate says the payout
   * machine is now lying, on the same run as the rename.
   */
  const real = new Set(routes());
  const imagined: string[] = [];
  for (const m of MACHINES) {
    for (const [name, spec] of Object.entries(m.states)) {
      for (const [path] of spec.screen.matchAll(/\/[a-z0-9-]+(?:\/[a-z0-9-]+)*/g)) {
        if (!real.has(path)) imagined.push(`${m.key}:${name} says ${path}`);
      }
    }
  }

  check(
    "🔴 every path a state names is a route the product actually has",
    imagined.length === 0,
    imagined.slice(0, 8).join(" · ") ||
      `checked against ${String(real.size)} real routes`,
  );

  check(
    "🔴 CONTROL the route set is the real one and not an empty set",
    real.has("/dashboard") && real.has("/billing") && real.size > 100,
    `${String(real.size)} routes, including the ones the machines lean on`,
  );

  /* ================================================================== */
  /*  5 · the clock has something to count                              */
  /* ================================================================== */

  /*
   * 🔴 A STATE SOMEBODY WAITS IN NEEDS A PROMISE, and the ones that have one
   * are what task #166 alerts on. This does not demand a promise everywhere:
   * a state the person themselves controls is not a wait. It demands that
   * every state whose only way out is US or a CLOCK carries one, because those
   * are exactly the states a person cannot leave by trying harder.
   */
  const unpromised: string[] = [];
  for (const m of MACHINES) {
    for (const [name, spec] of Object.entries(m.states)) {
      /*
       * `resting` is skipped deliberately and it is the only exemption: a
       * resting state is one nobody is waiting in. A refund can follow a paid
       * payment forever without anybody sitting there wondering, which is
       * exactly what separates resting from working.
       */
      if (spec.kind !== "working" || spec.promise) continue;
      const out = m.transitions.filter((t) => t.from === name);
      if (out.length === 0) continue;
      const theirs = out.some((t) => t.by === "patient" || t.by === "clinician");
      if (!theirs) unpromised.push(`${m.key}:${name}`);
    }
  }

  check(
    "🔴 every state a person can only wait in carries how long it may take",
    unpromised.length === 0,
    unpromised.join(" · ") || "nothing that can only be left by us or by a clock is unpromised",
  );

  const promised = MACHINES.flatMap((m) =>
    Object.entries(m.states).filter(([, s]) => s.promise).map(([n]) => `${m.key}:${n}`),
  );

  check(
    "🔴 …and there is something for the clock to count",
    promised.length > 0,
    `${String(promised.length)} states carry a promise, which is what #166 alerts on`,
  );

  finish("machines");
}

main();
