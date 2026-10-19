import type { BallType, FieldSpot, Position } from "@st/content";

export interface Point {
  x: number;
  y: number;
}

/** Field coords in SVG viewBox 0–100 (home bottom, 2B top). */
export const FIELD: Record<Position | "home" | Exclude<FieldSpot, Position>, Point> = {
  home: { x: 50, y: 88 },
  "1B": { x: 78, y: 58 },
  "2B": { x: 50, y: 28 },
  "3B": { x: 22, y: 58 },
  P: { x: 50, y: 62 },
  C: { x: 50, y: 92 },
  SS: { x: 36, y: 42 },
  LF: { x: 18, y: 22 },
  CF: { x: 50, y: 12 },
  RF: { x: 82, y: 22 },
  "cutoff-home": { x: 50, y: 48 },
  "cutoff-3B": { x: 38, y: 48 },
  "mound-1B": { x: 60, y: 56 },
  "SS-LF": { x: 28, y: 34 },
  backstop: { x: 50, y: 97 },
  gap: { x: 68, y: 22 },
};

/** Where batted balls land for a region (slightly in front of the fielder). */
export const BALL_LANDING: Partial<Record<FieldSpot, Point>> = {
  "1B": { x: 72, y: 54 },
  SS: { x: 38, y: 44 },
  LF: { x: 22, y: 28 },
  RF: { x: 78, y: 30 },
  CF: { x: 50, y: 18 },
  "2B": { x: 50, y: 30 },
  "mound-1B": { x: 60, y: 56 },
  "SS-LF": { x: 28, y: 34 },
  "3B": { x: 30, y: 64 },
  home: { x: 48, y: 80 },
  backstop: { x: 50, y: 97 },
  gap: { x: 68, y: 22 },
  C: { x: 50, y: 90 },
};

export const PLATE: Point = { x: 50, y: 86 };

export function pt(key: FieldSpot): Point {
  return FIELD[key];
}

export function landing(key: FieldSpot): Point {
  return BALL_LANDING[key] ?? FIELD[key];
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function bez2(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

export function midHigh(a: Point, b: Point, lift: number): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - lift };
}

type BaseKey = "home" | "1B" | "2B" | "3B";

/** Path along the baselines for a runner advance (e.g. 1B → 3B goes via 2B). */
export function basePath(from: BaseKey, to: BaseKey): Point[] {
  if (from === to) return [pt(from)];
  const order: BaseKey[] = ["home", "1B", "2B", "3B", "home"];
  const start = order.indexOf(from);
  const end = to === "home" ? 4 : order.indexOf(to);
  if (end <= start) return [pt(from), pt(to)];
  return order.slice(start, end + 1).map((b) => pt(b));
}

export function samplePolyline(points: Point[], t: number): Point {
  const first = points[0] as Point;
  if (points.length === 1) return first;
  const segs: { a: Point; b: Point; len: number }[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 0.001;
    segs.push({ a, b, len });
    total += len;
  }
  let dist = Math.max(0, Math.min(1, t)) * total;
  for (const s of segs) {
    if (dist <= s.len) {
      const u = dist / s.len;
      return { x: lerp(s.a.x, s.b.x, u), y: lerp(s.a.y, s.b.y, u) };
    }
    dist -= s.len;
  }
  return points[points.length - 1] as Point;
}

export type MotionStyle = "ground" | "line" | "arc" | "throw" | "pitch";

export interface MotionProfile {
  duration: number;
  peakH: number;
  style: MotionStyle;
}

export function ballProfile(type: BallType | "throw" | "hit"): MotionProfile {
  switch (type) {
    case "grounder":
      return { duration: 720, peakH: 0.12, style: "ground" };
    case "bunt":
      return { duration: 650, peakH: 0.08, style: "ground" };
    case "wild-pitch":
      return { duration: 700, peakH: 0.1, style: "ground" };
    case "gap":
      return { duration: 1100, peakH: 0.45, style: "line" };
    case "line":
      return { duration: 800, peakH: 0.3, style: "line" };
    case "popup":
      return { duration: 1300, peakH: 1, style: "arc" };
    case "fly":
      return { duration: 1400, peakH: 0.95, style: "arc" };
    case "steal":
      return { duration: 850, peakH: 0.4, style: "throw" };
    case "throw":
      return throwProfile();
    default:
      return { duration: 900, peakH: 0.35, style: "line" };
  }
}

export function throwProfile(): MotionProfile {
  return { duration: 700, peakH: 0.42, style: "throw" };
}

export function pitchProfile(): MotionProfile {
  return { duration: 480, peakH: 0.22, style: "pitch" };
}

/** Apparent height 0..peak..0 along a leg (t in 0..1). */
export function heightAt(t: number, peakH: number, style: MotionStyle): number {
  if (style === "ground") {
    const bounce = Math.abs(Math.sin(t * Math.PI * 2.2)) * peakH * 0.7;
    return peakH * 0.35 + bounce * (1 - t * 0.5);
  }
  if (style === "pitch") return peakH * Math.sin(Math.PI * t) * 0.85;
  return peakH * Math.sin(Math.PI * t);
}
