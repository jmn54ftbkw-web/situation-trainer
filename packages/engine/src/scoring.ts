export type Stars = 0 | 1 | 2 | 3;

export const LEVELS = ["Bench", "Starter", "Varsity", "All-Star"] as const;
export type Level = (typeof LEVELS)[number];

/** Seconds that must remain on the clock to earn 3 / 2 stars. */
export function starThresholds(totalSec: number): { three: number; two: number } {
  return { three: totalSec * 0.55, two: totalSec * 0.25 };
}

export function starsForAnswer(
  correct: boolean,
  elapsedSec: number,
  totalSec: number,
  timedOut: boolean,
): Stars {
  if (!correct || timedOut) return 0;
  const left = Math.max(0, totalSec - elapsedSec);
  const t = starThresholds(totalSec);
  if (left >= t.three) return 3;
  if (left >= t.two) return 2;
  return 1;
}

/**
 * Session score 0–1000: half accuracy, half star rate (stars vs plays × 3).
 * The formula is never shown to players.
 */
export function sessionScore(plays: number, correctCount: number, starsEarned: number): number {
  if (!plays) return 0;
  const accuracy = correctCount / plays;
  const starRate = starsEarned / (plays * 3);
  return Math.round(1000 * (0.5 * accuracy + 0.5 * starRate));
}

export function levelForScore(score: number): Level {
  if (score >= 800) return "All-Star";
  if (score >= 600) return "Varsity";
  if (score >= 400) return "Starter";
  return "Bench";
}

export type FeedbackTone = "hit" | "miss";

export function feedbackTitle(
  stars: Stars,
  correct: boolean,
  timedOut: boolean,
): { title: string; tone: FeedbackTone } {
  if (timedOut) return { title: "Time!", tone: "miss" };
  if (!correct) return { title: "Miss", tone: "miss" };
  return { title: stars === 3 ? "Quick!" : stars === 2 ? "Solid" : "Got it", tone: "hit" };
}
