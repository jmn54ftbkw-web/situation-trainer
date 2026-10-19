import type { Outcome, Position, Situation, RunnerEndState } from "@st/content";
import { color } from "@st/ui/tokens";
import { FIELD, type Point } from "./geometry.ts";
import { renderFieldSvg, runnerInnerMarkup } from "./scene.ts";
import {
  buildOutcomeTimeline,
  buildPlayTimeline,
  sampleOutcome,
  samplePlay,
  type BallSample,
  type FreezeSnapshot,
  type LegKind,
} from "./timeline.ts";

const SVG_NS = "http://www.w3.org/2000/svg";
const TRAIL_EVERY_MS = 28;

export interface FieldPlayerOptions {
  /** >1 plays faster (tests); 1 = authored timing. */
  speed?: number;
}

/**
 * Imperative DOM driver for the diamond. All motion math lives in `timeline.ts`; this class only
 * writes SVG attributes each animation frame.
 */
export class FieldPlayer {
  private raf: number | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private svg: SVGSVGElement | null = null;
  private readonly speed: number;

  constructor(
    private readonly container: HTMLElement,
    opts: FieldPlayerOptions = {},
  ) {
    this.speed = opts.speed ?? 1;
  }

  mount(sit: Situation, you: Position): void {
    this.stop();
    const runners = buildPlayTimeline(sit).runners.map((r) => r.start);
    this.container.querySelector(".diamond-svg")?.remove();
    this.container.insertAdjacentHTML("beforeend", renderFieldSvg({ you, runners }));
    this.svg = this.container.querySelector(".diamond-svg");
    this.setBall(FIELD.P, 0, false);
  }

  stop(): void {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /** Pitch + play. Resolves at the freeze point (mid-flight) or when the play ends. */
  playSequence(sit: Situation): Promise<FreezeSnapshot> {
    const tl = buildPlayTimeline(sit);
    this.resetTrails();
    const marks = this.runnerMarks();
    const first = tl.legs[0];
    if (first?.kind === "pitch") this.setBall(first.start, 0, true);

    return new Promise((resolve) => {
      let lastTrail = -Infinity;
      const t0 = performance.now();
      const frame = (now: number) => {
        const elapsed = (now - t0) * this.speed;
        const s = samplePlay(tl, elapsed);
        this.drawBall(s.ball);
        if (elapsed - lastTrail > TRAIL_EVERY_MS) {
          this.appendTrail(s.ball);
          lastTrail = elapsed;
        }
        s.runners.forEach((p, i) => marks[i] && translate(marks[i], p));
        if (s.frozen || s.done) {
          this.raf = null;
          resolve({ midFlight: s.frozen, ball: s.ball.ground });
          return;
        }
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  /** Finish animation for the resolved choice, then a short settle. */
  playOutcome(sit: Situation, outcome: Outcome, snap: FreezeSnapshot): Promise<void> {
    const tl = buildOutcomeTimeline(sit, outcome, snap);
    const used = new Set<Element>();
    const marks = tl.runners.map((r) => {
      const g = this.runnerMarkFor(r.from, used);
      used.add(g);
      g.setAttribute("data-start", r.from);
      translate(g, r.points[0] as Point);
      setRunnerState(g, null);
      return g;
    });

    return new Promise((resolve) => {
      if (!tl.legs.length) {
        marks.forEach((g, i) => setRunnerState(g, tl.runners[i]!.endState));
        this.after(500, resolve);
        return;
      }
      this.setBall(snap.ball, 0, true);
      let lastTrail = -Infinity;
      const t0 = performance.now();
      const frame = (now: number) => {
        const elapsed = (now - t0) * this.speed;
        const s = sampleOutcome(tl, elapsed);
        this.drawBall(s.ball);
        if (elapsed - lastTrail > TRAIL_EVERY_MS) {
          this.appendTrail(s.ball);
          lastTrail = elapsed;
        }
        s.runners.forEach((p, i) => marks[i] && translate(marks[i], p));
        if (s.done) {
          this.raf = null;
          marks.forEach((g, i) => setRunnerState(g, tl.runners[i]!.endState));
          this.after(420, resolve);
          return;
        }
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms / this.speed));
  }

  private runnerMarks(): SVGGElement[] {
    return Array.from(this.svg?.querySelectorAll<SVGGElement>(".runner-g") ?? []);
  }

  private runnerMarkFor(from: string, used: Set<Element>): SVGGElement {
    const existing = this.runnerMarks().find(
      (g) => g.getAttribute("data-start") === from && !used.has(g),
    );
    if (existing) return existing;
    const g = document.createElementNS(SVG_NS, "g");
    g.classList.add("runner-g");
    g.innerHTML = runnerInnerMarkup();
    const ball = this.svg?.querySelector("[data-ball]");
    this.svg?.insertBefore(g, ball ?? null);
    return g;
  }

  private resetTrails(): void {
    this.svg?.querySelectorAll("[data-trail]").forEach((p) => p.setAttribute("d", ""));
  }

  private appendTrail(b: BallSample): void {
    const path = this.svg?.querySelector(`[data-trail="${trailFor(b.kind)}"]`);
    if (!path) return;
    const x = b.ground.x.toFixed(2);
    const y = (b.ground.y - b.height * 10).toFixed(2);
    const d = path.getAttribute("d");
    path.setAttribute("d", d ? `${d} L ${x} ${y}` : `M ${x} ${y}`);
  }

  private drawBall(b: BallSample): void {
    this.setBall(b.ground, b.height, true);
  }

  private setBall(ground: Point, height: number, visible: boolean): void {
    const g = this.svg?.querySelector("[data-ball]");
    const shadow = this.svg?.querySelector("[data-ball-shadow]");
    const dot = this.svg?.querySelector("[data-ball-dot]");
    if (!g || !shadow || !dot) return;
    g.setAttribute("opacity", visible ? "1" : "0");
    const lift = height * 10;
    const scale = 1 + height * 0.85;
    const spread = 1 + height * 1.4;
    shadow.setAttribute("cx", String(ground.x));
    shadow.setAttribute("cy", String(ground.y + 0.6));
    shadow.setAttribute("rx", String(2.2 * spread));
    shadow.setAttribute("ry", String(1.05 * (0.85 + height * 0.4)));
    shadow.setAttribute("opacity", String(0.45 - height * 0.25));
    dot.setAttribute("cx", String(ground.x));
    dot.setAttribute("cy", String(ground.y - lift));
    dot.setAttribute("r", String(2.15 * scale));
  }
}

function trailFor(kind: LegKind): "pitch" | "hit" | "throw" {
  return kind;
}

function translate(g: Element, p: Point): void {
  g.setAttribute("transform", `translate(${p.x},${p.y})`);
}

function setRunnerState(g: Element, state: RunnerEndState | null): void {
  const label = g.querySelector(".runner-label");
  const dot = g.querySelector(".runner-dot");
  g.classList.remove("runner-out", "runner-safe", "runner-score");
  if (state === null) {
    if (label) label.textContent = "R";
    dot?.setAttribute("fill", color.amber);
  } else if (state === "out") {
    g.classList.add("runner-out");
    if (label) label.textContent = "X";
    dot?.setAttribute("fill", color.danger);
  } else if (state === "score") {
    g.classList.add("runner-score");
    if (label) label.textContent = "!";
    dot?.setAttribute("fill", color.ok);
  } else if (state === "safe") {
    g.classList.add("runner-safe");
    if (label) label.textContent = "S";
  }
}
