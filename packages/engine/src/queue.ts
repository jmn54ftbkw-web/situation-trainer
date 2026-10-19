import type { AgeBand, Position, Situation } from "@st/content";
import { shuffle, type Rng } from "./rng.ts";

export const SESSION_LEN = 5;

export interface QueueOptions {
  ageBand: AgeBand;
  position: Position;
  length?: number;
}

/**
 * Pick up to `length` situations for this POV, preferring tag variety.
 * Falls back to other age bands for the same position, then to the whole bank, only when the
 * narrower pool is empty (legacy behavior). Never mixes in other POVs when the position has items.
 */
export function buildQueue(
  bank: readonly Situation[],
  { ageBand, position, length = SESSION_LEN }: QueueOptions,
  rng: Rng,
): Situation[] {
  let pool = shuffle(
    bank.filter((s) => s.position === position && s.ageBands.includes(ageBand)),
    rng,
  );
  if (pool.length === 0) pool = shuffle(bank.filter((s) => s.position === position), rng);
  if (pool.length === 0) pool = shuffle(bank, rng);

  const picked: Situation[] = [];
  const usedTags = new Set<string>();
  const rest: Situation[] = [];
  for (const s of pool) {
    const novel = s.tags.some((t) => !usedTags.has(t));
    if (novel && picked.length < length) {
      picked.push(s);
      s.tags.forEach((t) => usedTags.add(t));
    } else {
      rest.push(s);
    }
  }
  for (const s of rest) {
    if (picked.length >= length) break;
    picked.push(s);
  }
  return picked;
}
