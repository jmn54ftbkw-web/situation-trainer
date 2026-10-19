import { describe, expect, it } from "vitest";
import { bank, type Situation } from "@st/content";
import {
  ballProfile,
  basePath,
  buildBallLegs,
  buildOutcomeTimeline,
  buildPlayTimeline,
  DEFAULT_SNAPSHOT,
  FIELD,
  heightAt,
  landing,
  renderFieldSvg,
  resolveRunners,
  runnerInnerMarkup,
  sampleOutcome,
  samplePlay,
  samplePolyline,
} from "../src/index.ts";

const byId = (id: string): Situation => bank.find((s) => s.id === id)!;

describe("geometry", () => {
  it("walks the baselines", () => {
    expect(basePath("1B", "3B")).toEqual([FIELD["1B"], FIELD["2B"], FIELD["3B"]]);
    expect(basePath("2B", "home")).toEqual([FIELD["2B"], FIELD["3B"], FIELD.home]);
    expect(basePath("1B", "1B")).toEqual([FIELD["1B"]]);
    expect(basePath("3B", "1B")).toEqual([FIELD["3B"], FIELD["1B"]]);
  });

  it("samples polylines and clamps", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(samplePolyline(pts, 0.5)).toEqual({ x: 5, y: 0 });
    expect(samplePolyline(pts, 2)).toEqual({ x: 10, y: 0 });
    expect(samplePolyline([pts[0]!], 0.3)).toEqual(pts[0]);
    const degenerate = [pts[0]!, pts[0]!];
    expect(samplePolyline(degenerate, 1)).toEqual(pts[0]);
  });

  it("has a profile for every ball type", () => {
    for (const t of ["grounder", "bunt", "wild-pitch", "single", "gap", "line", "popup", "fly", "steal", "throw", "hit"] as const) {
      expect(ballProfile(t).duration).toBeGreaterThan(0);
    }
    expect(heightAt(0.5, 1, "arc")).toBeCloseTo(1);
    expect(heightAt(0.5, 1, "pitch")).toBeCloseTo(0.85);
    expect(heightAt(0, 1, "ground")).toBeCloseTo(0.35);
    expect(landing("cutoff-home")).toEqual(FIELD["cutoff-home"]);
  });
});

describe("play timeline", () => {
  it("builds pitch + hit + throw legs", () => {
    const legs = buildBallLegs(byId("tag-up-cf"));
    expect(legs.map((l) => l.kind)).toEqual(["pitch", "hit", "throw"]);
    expect(buildBallLegs(byId("ss-steal-cover")).map((l) => l.kind)).toEqual(["pitch", "throw"]);
    expect(buildBallLegs(byId("backup-p-wp"))[1]!.end).toEqual(landing("backstop"));
    const noPitch = { ...byId("force-1b-grounder") };
    noPitch.sequence = { ...noPitch.sequence, pitch: false };
    expect(buildBallLegs(noPitch)[0]!.start).toEqual(FIELD.home);
    const wpNoPitch = { ...byId("backup-p-wp") };
    wpNoPitch.sequence = { ...wpNoPitch.sequence, pitch: false };
    expect(buildBallLegs(wpNoPitch)[0]!.start).toEqual(FIELD.home);
  });

  it("merges base runners with motion including batter-runner", () => {
    const rs = resolveRunners(byId("tag-up-ss"));
    expect(rs.map((r) => [r.start, r.end, r.timing])).toEqual([
      ["1B", "2B", "delayed"],
      ["3B", "home", "after-catch"],
    ]);
    expect(resolveRunners(byId("bunt-c-cover"))[0]).toMatchObject({ start: "home", end: "1B" });
    expect(resolveRunners(byId("popup-priority-ss"))[0]?.timing).toBe("hold");
  });

  it("freezes in-flight at the authored point", () => {
    const tl = buildPlayTimeline(byId("tag-up-cf"));
    expect(tl.freezeAtMs).toBeCloseTo(tl.actionStart + tl.actionDur * 0.58);
    const before = samplePlay(tl, tl.freezeAtMs! - 1);
    expect(before.frozen).toBe(false);
    const at = samplePlay(tl, tl.freezeAtMs! + 500);
    expect(at.frozen).toBe(true);
    expect(at.done).toBe(false);
    expect(at.ball.height).toBeGreaterThan(0);
    const dflt = { ...byId("tag-up-cf") };
    dflt.sequence = { ...dflt.sequence, freeze: { mode: "in-flight" } };
    const d = buildPlayTimeline(dflt);
    expect(d.freezeAtMs).toBeCloseTo(d.actionStart + d.actionDur * 0.55);
  });

  it("runs after-freeze plays to completion with runners at their ends", () => {
    const sit = byId("tag-up-ss");
    const tl = buildPlayTimeline(sit);
    expect(tl.freezeAtMs).toBeNull();
    const mid = samplePlay(tl, tl.catchMs + 400);
    expect(mid.done).toBe(false);
    const end = samplePlay(tl, tl.totalMs + 1);
    expect(end.done).toBe(true);
    expect(end.runners).toEqual([FIELD["2B"], FIELD.home]);
    expect(samplePlay(tl, 0).runners).toEqual([FIELD["1B"], FIELD["3B"]]);
    const withBall = buildPlayTimeline(byId("force-1b-grounder"));
    expect(samplePlay(withBall, withBall.actionStart + withBall.actionDur / 2).runners[0]).not.toEqual(
      FIELD["1B"],
    );
  });

  it("samples every bank situation without NaN", () => {
    for (const s of bank) {
      const tl = buildPlayTimeline(s);
      for (let t = 0; t <= tl.totalMs + 50; t += 97) {
        const p = samplePlay(tl, t);
        expect(Number.isFinite(p.ball.ground.x + p.ball.ground.y + p.ball.height)).toBe(true);
      }
    }
  });
});

describe("outcome timeline", () => {
  it("completes the landing, drops, then follows the ball path", () => {
    const sit = byId("cf-shallow-priority");
    const wrong = sit.choices.find((c) => !c.correct)!.outcome;
    const tl = buildOutcomeTimeline(sit, wrong, { midFlight: true, ball: { x: 50, y: 40 } });
    expect(tl.legs.length).toBe(2);
    expect(tl.caption).toBe(wrong.caption);
    const end = sampleOutcome(tl, tl.totalMs);
    expect(end.done).toBe(true);
    expect(sampleOutcome(tl, tl.totalMs / 2).done).toBe(false);
  });

  it("handles no-leg outcomes and hold runners", () => {
    const sit = byId("popup-priority-ss");
    const right = sit.choices.find((c) => c.correct)!.outcome;
    const tl = buildOutcomeTimeline(sit, right, DEFAULT_SNAPSHOT);
    expect(tl.legs).toEqual([]);
    const s = sampleOutcome(tl, 0);
    expect(s.done).toBe(true);
    expect(s.runners[0]).toEqual(FIELD["1B"]);
    expect(s.ball.ground).toEqual(FIELD.P);
  });

  it("honors completeToLanding=false and steal throws and hit steps", () => {
    const sit = byId("ss-steal-cover");
    const o = structuredClone(sit.choices[0]!.outcome);
    const tl = buildOutcomeTimeline(sit, o, { midFlight: true, ball: { x: 50, y: 50 } });
    expect(tl.legs[0]!.kind).toBe("throw");
    o.animation.completeToLanding = false;
    o.animation.ballPath = [{ to: "home", kind: "hit" }];
    const tl2 = buildOutcomeTimeline(sit, o, { midFlight: true, ball: { x: 50, y: 50 } });
    expect(tl2.legs.map((l) => l.kind)).toEqual(["hit"]);
    const runners = sampleOutcome(tl2, tl2.totalMs / 2).runners;
    expect(runners[0]).not.toEqual(FIELD["1B"]);
  });
});

describe("scene", () => {
  it("renders the diamond with you and runners", () => {
    const svg = renderFieldSvg({ you: "SS", runners: ["1B", "home"] });
    expect(svg).toContain('class="pos-spot you"');
    expect(svg.match(/class="runner-g"/g)).toHaveLength(2);
    expect(svg).toContain('data-start="home"');
    expect(runnerInnerMarkup()).toContain("runner-dot");
    expect(runnerInnerMarkup()).not.toMatch(/^<g/);
  });
});
