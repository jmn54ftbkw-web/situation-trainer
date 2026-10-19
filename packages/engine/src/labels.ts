import type { GameStateSnapshot, Runners } from "@st/content";

export function outsLabel(n: number): string {
  if (n === 0) return "nobody out";
  if (n === 1) return "1 out";
  return "2 outs";
}

export function runnersLabel(runners: Runners): string {
  const bases: string[] = [];
  if (runners["1B"]) bases.push("1st");
  if (runners["2B"]) bases.push("2nd");
  if (runners["3B"]) bases.push("3rd");
  if (!bases.length) return "bases empty";
  if (bases.length === 3) return "bases loaded";
  if (bases.length === 1) return "runner on " + bases[0];
  return "runners on " + bases.join(" and ");
}

export function countLabel(balls: number, strikes: number): string {
  const ballPart = balls === 1 ? "1 ball" : `${balls} balls`;
  const strikePart = strikes === 0 ? "no strikes" : strikes === 1 ? "1 strike" : `${strikes} strikes`;
  return `${ballPart}, ${strikePart}`;
}

/** Kid-clear pre-pitch setup, e.g. "2 balls, no strikes, nobody out, runner on 1st". */
export function setupLine(gs: GameStateSnapshot): string {
  return `${countLabel(gs.balls, gs.strikes)}, ${outsLabel(gs.outs)}, ${runnersLabel(gs.runners)}`;
}

export const PITCH_LINE = "Here's the pitch…";
