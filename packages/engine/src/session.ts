import {
  TAG_LABELS,
  type AgeBand,
  type Choice,
  type Position,
  type Situation,
  type Tag,
} from "@st/content";
import { buildQueue, SESSION_LEN } from "./queue.ts";
import { createRng, deriveSeed, shuffle } from "./rng.ts";
import { levelForScore, sessionScore, starsForAnswer, type Level, type Stars } from "./scoring.ts";
import { timerSeconds } from "./timing.ts";

export interface AnswerRecord {
  situationId: string;
  tags: Tag[];
  choiceId: string | null;
  correct: boolean;
  stars: Stars;
  timedOut: boolean;
  elapsedSec: number;
}

export interface TrainSession {
  readonly ageBand: AgeBand;
  readonly position: Position;
  readonly seed: number;
  readonly queue: readonly Situation[];
  readonly index: number;
  readonly answers: readonly AnswerRecord[];
}

export interface CreateSessionOptions {
  bank: readonly Situation[];
  ageBand: AgeBand;
  position: Position;
  seed: number;
  length?: number;
}

export function createSession({
  bank,
  ageBand,
  position,
  seed,
  length = SESSION_LEN,
}: CreateSessionOptions): TrainSession {
  const queue = buildQueue(bank, { ageBand, position, length }, createRng(deriveSeed(seed, 0)));
  return { ageBand, position, seed, queue, index: 0, answers: [] };
}

export function currentSituation(s: TrainSession): Situation | undefined {
  return s.queue[s.index];
}

/** Display order of choices for play `index`. Deterministic per (seed, index). */
export function choiceOrder(s: TrainSession, index = s.index): Choice[] {
  const sit = s.queue[index];
  if (!sit) return [];
  return shuffle(sit.choices, createRng(deriveSeed(s.seed, index + 1)));
}

export function isCorrectChoice(sit: Situation, choiceId: string | null): boolean {
  return choiceId != null && sit.choices.some((c) => c.id === choiceId && c.correct);
}

/** The choice whose outcome plays out: the pick, or (on timeout) the first wrong choice. */
export function resolvedChoice(sit: Situation, choiceId: string | null): Choice {
  const picked = sit.choices.find((c) => c.id === choiceId);
  if (picked) return picked;
  return sit.choices.find((c) => !c.correct) ?? (sit.choices[0] as Choice);
}

export interface AnswerInput {
  choiceId: string | null;
  elapsedSec: number;
  timedOut?: boolean;
}

export function answerCurrent(
  s: TrainSession,
  { choiceId, elapsedSec, timedOut = false }: AnswerInput,
): { session: TrainSession; answer: AnswerRecord; choice: Choice } {
  const sit = currentSituation(s);
  if (!sit) throw new Error("Session is complete");
  if (s.answers.length > s.index) throw new Error("Current play already answered");
  const correct = !timedOut && isCorrectChoice(sit, choiceId);
  const answer: AnswerRecord = {
    situationId: sit.id,
    tags: sit.tags,
    choiceId: timedOut ? null : choiceId,
    correct,
    stars: starsForAnswer(correct, elapsedSec, timerSeconds(s.ageBand), timedOut),
    timedOut,
    elapsedSec,
  };
  return {
    session: { ...s, answers: [...s.answers, answer] },
    answer,
    choice: resolvedChoice(sit, timedOut ? null : choiceId),
  };
}

export function isLastPlay(s: TrainSession): boolean {
  return s.index >= s.queue.length - 1;
}

export function advance(s: TrainSession): TrainSession {
  return { ...s, index: Math.min(s.index + 1, s.queue.length) };
}

export function isComplete(s: TrainSession): boolean {
  return s.answers.length >= s.queue.length;
}

/** Restart with the same POV/age band and a fresh queue. */
export function restart(s: TrainSession, bank: readonly Situation[], seed: number): TrainSession {
  return createSession({ bank, ageBand: s.ageBand, position: s.position, seed });
}

export interface SessionSummary {
  plays: number;
  correct: number;
  stars: number;
  accuracyPct: number;
  score: number;
  level: Level;
  /** Up to 3 human labels for the most-missed tags; empty for a clean session. */
  reviewPatterns: string[];
}

export function runningScore(s: TrainSession): number {
  const correct = s.answers.filter((a) => a.correct).length;
  const stars = s.answers.reduce((n, a) => n + a.stars, 0);
  return sessionScore(s.answers.length, correct, stars);
}

export function summarize(s: TrainSession): SessionSummary {
  const plays = s.queue.length;
  const correct = s.answers.filter((a) => a.correct).length;
  const stars = s.answers.reduce((n, a) => n + a.stars, 0);
  const score = sessionScore(plays, correct, stars);
  const missTags = new Map<Tag, number>();
  for (const a of s.answers) {
    if (a.correct) continue;
    for (const t of a.tags) missTags.set(t, (missTags.get(t) ?? 0) + 1);
  }
  const reviewPatterns = [...missTags.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => TAG_LABELS[t]);
  return {
    plays,
    correct,
    stars,
    accuracyPct: plays ? Math.round((correct / plays) * 100) : 0,
    score,
    level: levelForScore(score),
    reviewPatterns,
  };
}
