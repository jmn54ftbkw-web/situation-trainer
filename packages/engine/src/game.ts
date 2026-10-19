/**
 * Play-mode game state (phase 5). The contract is fixed here so Train and Play share outcome
 * semantics; the inning simulator and situation selection for Play mode are not built yet.
 */
import type { GameStateSnapshot, Outcome, Runners, Side } from "@st/content";

export const INNINGS = 7;

export interface GameState {
  inning: number;
  /** Which side the player is on this half-inning. */
  side: Side;
  outs: number;
  balls: number;
  strikes: number;
  runners: Runners;
  score: { us: number; them: number };
  final: boolean;
}

export type GameEvent =
  | { type: "out"; count: number }
  | { type: "run"; count: number }
  | { type: "side-retired" }
  | { type: "game-over" };

export function emptyRunners(): Runners {
  return { "1B": false, "2B": false, "3B": false };
}

export function initialGameState(side: Side = "defense"): GameState {
  return {
    inning: 1,
    side,
    outs: 0,
    balls: 0,
    strikes: 0,
    runners: emptyRunners(),
    score: { us: 0, them: 0 },
    final: false,
  };
}

/** Lift a situation's authored snapshot into a full game state (for previews and tests). */
export function fromSnapshot(snap: GameStateSnapshot, side: Side = "defense"): GameState {
  return {
    ...initialGameState(side),
    inning: snap.inning,
    outs: snap.outs,
    balls: snap.balls,
    strikes: snap.strikes,
    runners: { ...snap.runners },
  };
}

/**
 * Apply a choice's outcome. Outs come from runner marks ending "out" plus `batterOut`; runs from
 * runners ending "score"; bases from runners ending "safe"/"hold". Runners not mentioned stay put.
 * Three outs retires the side (bases and count reset, side flips; inning advances after both
 * halves). The game is final after INNINGS full innings.
 */
export function applyOutcome(
  state: GameState,
  outcome: Outcome,
): { state: GameState; events: GameEvent[] } {
  if (state.final) return { state, events: [] };
  const events: GameEvent[] = [];
  const runners: Runners = { ...state.runners };
  let outs = 0;
  let runs = 0;

  for (const r of outcome.animation.runners) {
    if (r.from !== "home") runners[r.from] = false;
  }
  for (const r of outcome.animation.runners) {
    if (r.endState === "out") outs += 1;
    else if (r.endState === "score") runs += 1;
    else if (r.to !== "home") runners[r.to] = true;
  }
  if (outcome.batterOut) outs += 1;

  const score = { ...state.score };
  if (runs) {
    if (state.side === "offense") score.us += runs;
    else score.them += runs;
    events.push({ type: "run", count: runs });
  }
  if (outs) events.push({ type: "out", count: outs });

  let next: GameState = {
    ...state,
    outs: state.outs + outs,
    balls: 0,
    strikes: 0,
    runners,
    score,
  };

  if (next.outs >= 3) {
    events.push({ type: "side-retired" });
    const bothHalvesDone = state.side === "offense";
    const inning = bothHalvesDone ? state.inning + 1 : state.inning;
    next = {
      ...next,
      outs: 0,
      runners: emptyRunners(),
      side: state.side === "defense" ? "offense" : "defense",
      inning,
    };
    if (inning > INNINGS) {
      next = { ...next, inning: INNINGS, final: true };
      events.push({ type: "game-over" });
    }
  }

  return { state: next, events };
}
