"use server";

import { requireManager } from "@/lib/auth/guard";
import {
  activityBoard,
  aiBoard,
  clinicsBoard,
  companiesBoard,
  moneyBoard,
  patientsBoard,
  paymentsBoard,
  sessionsBoard,
  therapistsBoard,
  wholeBoard,
  type WholeBoard,
} from "@/lib/console/board";

/**
 * 🔴 76.1 — ONE ACTION PER SECTION, AND ONE FOR EVERYTHING.
 *
 * ## Why refresh is a button and not a poll
 *
 * A founder reads this board for minutes at a time. A board that re-queries
 * itself every ten seconds re-sorts a roster under somebody's finger, and it
 * turns nine counts over the whole database into a standing load for a screen
 * two people look at. So nothing moves until somebody asks it to, and the screen
 * says when each section was last read.
 *
 * ## 🔴 AND PER SECTION, BECAUSE THE SECTIONS HAVE DIFFERENT CLOCKS
 *
 * The transfer queue changes by the minute and somebody is waiting on every row
 * in it. The clinic roster changes twice a month. Forcing them to refresh
 * together means either the queue is stale or the roster is thrashing.
 *
 * Every one of these is `requireManager()`, the same guard as the page: an
 * action reachable without the page is an action somebody can call directly.
 */
export type Section = keyof WholeBoard;

export async function refreshAll(): Promise<WholeBoard> {
  await requireManager();
  return wholeBoard();
}

export async function refreshMoney() {
  await requireManager();
  return moneyBoard();
}

export async function refreshCompanies() {
  await requireManager();
  return companiesBoard();
}

export async function refreshClinics() {
  await requireManager();
  return clinicsBoard();
}

export async function refreshTherapists() {
  await requireManager();
  return therapistsBoard();
}

export async function refreshSessions() {
  await requireManager();
  return sessionsBoard();
}

export async function refreshAi() {
  await requireManager();
  return aiBoard();
}

export async function refreshPayments() {
  await requireManager();
  return paymentsBoard();
}

export async function refreshPatients() {
  await requireManager();
  return patientsBoard();
}

export async function refreshActivity() {
  await requireManager();
  return activityBoard();
}
