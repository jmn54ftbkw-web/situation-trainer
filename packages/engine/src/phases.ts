/**
 * One play's phase machine:
 * setup → pitch → play → freeze → read → decide → outcome → feedback
 *
 * - setup:    situation-first cue (count, outs, runners); nothing moves
 * - pitch:    "Here's the pitch…" line
 * - play:     pitch + batted ball + runners animate
 * - freeze:   hold mid-flight or after the play
 * - read:     prompt shown, choices veiled, clock not running
 * - decide:   choices live, clock running
 * - outcome:  finish animation for the chosen (or timed-out) answer
 * - feedback: stars + explanation
 */
export const PHASES = [
  "setup",
  "pitch",
  "play",
  "freeze",
  "read",
  "decide",
  "outcome",
  "feedback",
] as const;
export type Phase = (typeof PHASES)[number];

export function nextPhase(p: Phase): Phase | null {
  const i = PHASES.indexOf(p);
  return PHASES[i + 1] ?? null;
}

export function canTransition(from: Phase, to: Phase): boolean {
  return nextPhase(from) === to;
}
