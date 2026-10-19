/** A deterministic random source returning floats in [0, 1). */
export type Rng = () => number;

/** mulberry32 — tiny, fast, good enough for shuffles. Same seed ⇒ same sequence. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Child seed so independent streams (queue, per-play choice order) don't interfere. */
export function deriveSeed(seed: number, n: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n + 1, 0xc2b2ae35)) >>> 0;
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}
