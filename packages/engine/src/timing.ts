import type { AgeBand, Situation } from "@st/content";

/** Decision clock per age band (seconds). */
export function timerSeconds(ageBand: AgeBand): number {
  return ageBand === "8U-10U" ? 8 : 6;
}

/** Read beat before choices appear — long enough for 8U–14U to finish the prompt. */
export function questionReadMs(ageBand: AgeBand): number {
  return ageBand === "8U-10U" ? 5000 : 4200;
}

/** Fixed beats of the drill sequence (ms). The UI may scale these for tests/reduced motion. */
export const BEATS = {
  /** Situation-first cue (count/outs/runners) before anything moves. */
  setup: 2200,
  /** "Here's the pitch…" line before the pitch animates. */
  pitchCue: 900,
  freezeInFlight: 400,
  freezeAfter: 550,
  outcomeLeadAnswered: 280,
  outcomeLeadTimedOut: 180,
} as const;

export function freezeHoldMs(midFlight: boolean): number {
  return midFlight ? BEATS.freezeInFlight : BEATS.freezeAfter;
}

export function freezeMode(s: Situation): "in-flight" | "after" {
  return s.sequence.freeze.mode;
}
