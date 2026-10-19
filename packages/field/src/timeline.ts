import type { Outcome, RunnerEndState, RunnerTiming, Situation } from "@st/content";
import {
  ballProfile,
  basePath,
  bez2,
  easeInOut,
  easeOutCubic,
  FIELD,
  heightAt,
  landing,
  midHigh,
  pitchProfile,
  PLATE,
  pt,
  samplePolyline,
  throwProfile,
  type MotionProfile,
  type Point,
} from "./geometry.ts";

export type LegKind = "pitch" | "hit" | "throw";

export interface Leg {
  start: Point;
  end: Point;
  profile: MotionProfile;
  kind: LegKind;
}

type BaseKey = "home" | "1B" | "2B" | "3B";

export interface RunnerTrack {
  /** Base the runner mark starts on (used to match marks between play and outcome). */
  start: BaseKey;
  end: BaseKey;
  points: Point[];
  timing: RunnerTiming | "hold";
}

export interface PlayTimeline {
  legs: Leg[];
  starts: number[];
  totalMs: number;
  actionStart: number;
  actionDur: number;
  /** Fielding moment = end of the first non-pitch leg. */
  catchMs: number;
  freezeAtMs: number | null;
  runners: RunnerTrack[];
}

export interface BallSample {
  ground: Point;
  height: number;
  kind: LegKind;
}

export interface PlaySample {
  ball: BallSample;
  runners: Point[];
  /** Reached the in-flight freeze point. */
  frozen: boolean;
  done: boolean;
}

export function buildBallLegs(sit: Situation): Leg[] {
  const { ball, pitch } = sit.sequence;
  const legs: Leg[] = [];
  if (pitch) legs.push({ start: pt("P"), end: PLATE, profile: pitchProfile(), kind: "pitch" });

  if (ball.type === "steal") {
    legs.push({
      start: pt(ball.from),
      end: landing(ball.region),
      profile: ballProfile("steal"),
      kind: "throw",
    });
  } else if (ball.type === "wild-pitch") {
    legs.push({
      start: pitch ? PLATE : pt("home"),
      end: landing("backstop"),
      profile: ballProfile("wild-pitch"),
      kind: "hit",
    });
  } else {
    const end = landing(ball.region);
    legs.push({
      start: pitch ? PLATE : pt(ball.from),
      end,
      profile: ballProfile(ball.type),
      kind: "hit",
    });
    if (ball.throwTo) {
      legs.push({ start: end, end: pt(ball.throwTo), profile: throwProfile(), kind: "throw" });
    }
  }
  return legs;
}

/** Runners on base at the start, merged with authored motion (batter-runner from home). */
export function resolveRunners(sit: Situation): RunnerTrack[] {
  const tracks: RunnerTrack[] = [];
  const { runners } = sit.gameState;
  for (const b of ["1B", "2B", "3B"] as const) {
    if (runners[b]) tracks.push({ start: b, end: b, points: [], timing: "hold" });
  }
  for (const m of sit.sequence.runnerMotion) {
    const existing = m.from === "home" ? undefined : tracks.find((r) => r.start === m.from);
    if (existing) {
      existing.end = m.to;
      existing.timing = m.timing;
    } else {
      tracks.push({ start: m.from, end: m.to, points: [], timing: m.timing });
    }
  }
  for (const r of tracks) r.points = basePath(r.start, r.end);
  return tracks;
}

function legLift(leg: Leg): number {
  if (leg.profile.style === "ground") return 2;
  if (leg.kind === "pitch") return leg.profile.peakH * 8;
  return leg.profile.peakH * 14;
}

export function sampleLeg(leg: Leg, localT: number): BallSample {
  const t = leg.kind === "throw" || leg.kind === "pitch" ? easeOutCubic(localT) : easeInOut(localT);
  const ctrl = midHigh(leg.start, leg.end, legLift(leg));
  return {
    ground: bez2(leg.start, ctrl, leg.end, t),
    height: heightAt(t, leg.profile.peakH, leg.profile.style),
    kind: leg.kind,
  };
}

function legStarts(legs: Leg[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let acc = 0;
  for (const l of legs) {
    starts.push(acc);
    acc += l.profile.duration;
  }
  return { starts, total: acc };
}

function legAt(legs: Leg[], starts: number[], elapsed: number): { leg: Leg; localT: number } {
  let i = legs.length - 1;
  for (let k = 0; k < legs.length; k++) {
    if (elapsed <= (starts[k] as number) + (legs[k] as Leg).profile.duration) {
      i = k;
      break;
    }
  }
  const leg = legs[i] as Leg;
  const localT = Math.min(1, Math.max(0, (elapsed - (starts[i] as number)) / leg.profile.duration));
  return { leg, localT };
}

export function buildPlayTimeline(sit: Situation): PlayTimeline {
  const legs = buildBallLegs(sit);
  const { starts, total } = legStarts(legs);
  const actionIdx = legs.findIndex((l) => l.kind !== "pitch");
  const actionStart = actionIdx >= 0 ? (starts[actionIdx] as number) : 0;
  const actionDur = actionIdx >= 0 ? (legs[actionIdx] as Leg).profile.duration : total;
  let freezeAtMs: number | null = null;
  const { freeze } = sit.sequence;
  if (freeze.mode === "in-flight" && actionIdx >= 0) {
    const at = Math.min(0.85, Math.max(0.35, freeze.at ?? 0.55));
    freezeAtMs = actionStart + actionDur * at;
  }
  return {
    legs,
    starts,
    totalMs: total,
    actionStart,
    actionDur,
    catchMs: actionStart + actionDur,
    freezeAtMs,
    runners: resolveRunners(sit),
  };
}

function runnerProgress(
  timing: RunnerTrack["timing"],
  actionT: number,
  tl: PlayTimeline,
  now: number,
): number {
  if (timing === "hold") return 0;
  if (timing === "after-catch") {
    if (now < tl.catchMs) return 0;
    return easeOutCubic(Math.min(1, (now - tl.catchMs) / Math.max(280, tl.totalMs - tl.catchMs)));
  }
  if (timing === "delayed") {
    const start = tl.catchMs + 180;
    if (now < start) return 0;
    return easeInOut(Math.min(1, (now - start) / 700));
  }
  if (now < tl.actionStart) return 0;
  return easeInOut(Math.min(1, Math.max(0, actionT * 1.05 - 0.05)));
}

export function samplePlay(tl: PlayTimeline, elapsedMs: number): PlaySample {
  const frozen = tl.freezeAtMs != null && elapsedMs >= tl.freezeAtMs;
  const t = frozen ? (tl.freezeAtMs as number) : Math.min(elapsedMs, tl.totalMs);
  const done = !frozen && elapsedMs >= tl.totalMs;

  let ball: BallSample;
  if (done) {
    const last = tl.legs[tl.legs.length - 1] as Leg;
    ball = { ground: last.end, height: 0, kind: last.kind };
  } else {
    const { leg, localT } = legAt(tl.legs, tl.starts, t);
    ball = sampleLeg(leg, localT);
  }

  const actionT = t <= tl.actionStart ? 0 : Math.min(1, (t - tl.actionStart) / tl.actionDur);
  const runners = tl.runners.map((r) =>
    done
      ? (r.points[r.points.length - 1] as Point)
      : samplePolyline(r.points, runnerProgress(r.timing, actionT, tl, t)),
  );
  return { ball, runners, frozen, done };
}

/* ——— Outcome (finish) ——— */

export interface FreezeSnapshot {
  midFlight: boolean;
  ball: Point;
}

export interface OutcomeRunnerTrack {
  from: BaseKey;
  points: Point[];
  endState: RunnerEndState;
  hold: boolean;
}

export interface OutcomeTimeline {
  legs: Leg[];
  starts: number[];
  totalMs: number;
  runners: OutcomeRunnerTrack[];
  caption: string;
  start: Point;
}

export function buildOutcomeTimeline(
  sit: Situation,
  outcome: Outcome,
  snap: FreezeSnapshot,
): OutcomeTimeline {
  const anim = outcome.animation;
  const legs: Leg[] = [];
  const origin = snap.ball;
  let start = origin;
  const { ball } = sit.sequence;

  if (anim.completeToLanding !== false && snap.midFlight) {
    const end = landing(ball.region);
    const base = ballProfile(ball.type);
    legs.push({
      start,
      end,
      profile: { ...base, duration: Math.max(320, base.duration * 0.45) },
      kind: ball.type === "steal" ? "throw" : "hit",
    });
    start = end;
  }

  if (anim.drop) {
    const dirt = { x: start.x + 2, y: start.y + 4 };
    legs.push({
      start,
      end: dirt,
      profile: { duration: 380, peakH: 0.08, style: "ground" },
      kind: "hit",
    });
    start = dirt;
  }

  for (const step of anim.ballPath) {
    const end = pt(step.to);
    legs.push({
      start,
      end,
      profile: step.kind === "throw" ? throwProfile() : ballProfile("hit"),
      kind: step.kind,
    });
    start = end;
  }

  const { starts, total } = legStarts(legs);
  return {
    legs,
    starts,
    totalMs: total,
    caption: outcome.caption,
    start: origin,
    runners: anim.runners.map((r) => ({
      from: r.from,
      points: basePath(r.from, r.to),
      endState: r.endState,
      hold: r.to === r.from,
    })),
  };
}

export interface OutcomeSample {
  ball: BallSample;
  runners: Point[];
  done: boolean;
}

export function sampleOutcome(tl: OutcomeTimeline, elapsedMs: number): OutcomeSample {
  const done = elapsedMs >= tl.totalMs;
  let ball: BallSample;
  if (!tl.legs.length) {
    ball = { ground: tl.start, height: 0, kind: "hit" };
  } else if (done) {
    const last = tl.legs[tl.legs.length - 1] as Leg;
    ball = { ground: last.end, height: 0, kind: last.kind };
  } else {
    const { leg, localT } = legAt(tl.legs, tl.starts, elapsedMs);
    ball = sampleLeg(leg, localT);
  }
  const u = tl.totalMs ? Math.min(1, elapsedMs / tl.totalMs) : 1;
  const rp = easeInOut(u);
  const runners = tl.runners.map((r) =>
    r.hold ? (r.points[0] as Point) : samplePolyline(r.points, done ? 1 : rp),
  );
  return { ball, runners, done };
}

export const DEFAULT_SNAPSHOT: FreezeSnapshot = { midFlight: false, ball: FIELD.P };
