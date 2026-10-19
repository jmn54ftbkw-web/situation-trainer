/**
 * Runtime knobs read from the URL (used by e2e tests and QA):
 *   ?seed=123   deterministic session order and choice shuffles
 *   ?speed=10   play beats/animations faster (the decision clock is never scaled)
 */
export interface RuntimeConfig {
  seed: number | null;
  speed: number;
}

export function readConfig(search: string = window.location.search): RuntimeConfig {
  const q = new URLSearchParams(search);
  const seed = q.get("seed");
  const speed = Number(q.get("speed"));
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    seed: seed !== null && Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : null,
    speed: Number.isFinite(speed) && speed > 0 ? speed : reduced ? 2 : 1,
  };
}

let counter = 0;
/** Seed for the next session: fixed seeds still vary per session within one page load. */
export function nextSeed(cfg: RuntimeConfig): number {
  counter += 1;
  if (cfg.seed !== null) return (cfg.seed + counter - 1) >>> 0;
  return (Math.random() * 2 ** 32) >>> 0;
}
