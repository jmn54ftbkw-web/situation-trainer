import { describe, expect, it } from "vitest";
import { bank, type Outcome, type Situation } from "@st/content";
import {
  advance,
  answerCurrent,
  applyOutcome,
  BEATS,
  buildQueue,
  canTransition,
  choiceOrder,
  countLabel,
  createRng,
  createSession,
  currentSituation,
  deriveSeed,
  feedbackTitle,
  freezeHoldMs,
  freezeMode,
  fromSnapshot,
  initialGameState,
  isComplete,
  isCorrectChoice,
  isLastPlay,
  levelForScore,
  nextPhase,
  outsLabel,
  PHASES,
  questionReadMs,
  resolvedChoice,
  restart,
  runnersLabel,
  runningScore,
  sessionScore,
  setupLine,
  shuffle,
  starsForAnswer,
  summarize,
  timerSeconds,
} from "../src/index.ts";

const byId = (id: string): Situation => bank.find((s) => s.id === id)!;

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect(createRng(43)()).not.toBe(seqA[0]);
    seqA.forEach((x) => expect(x >= 0 && x < 1).toBe(true));
  });

  it("shuffles a copy and keeps all items", () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffle(src, createRng(1));
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(src);
    expect(shuffle(src, createRng(1))).toEqual(out);
  });

  it("derives distinct child seeds", () => {
    expect(deriveSeed(1, 0)).not.toBe(deriveSeed(1, 1));
    expect(deriveSeed(1, 0)).toBe(deriveSeed(1, 0));
  });
});

describe("timing", () => {
  it("matches legacy clocks and beats", () => {
    expect(timerSeconds("8U-10U")).toBe(8);
    expect(timerSeconds("12U-14U")).toBe(6);
    expect(questionReadMs("8U-10U")).toBe(5000);
    expect(questionReadMs("12U-14U")).toBe(4200);
    expect(freezeHoldMs(true)).toBe(BEATS.freezeInFlight);
    expect(freezeHoldMs(false)).toBe(BEATS.freezeAfter);
    expect(freezeMode(byId("tag-up-cf"))).toBe("in-flight");
    expect(freezeMode(byId("bunt-c-cover"))).toBe("after");
  });
});

describe("scoring", () => {
  it("awards stars by time left", () => {
    expect(starsForAnswer(true, 1, 8, false)).toBe(3);
    expect(starsForAnswer(true, 5, 8, false)).toBe(2);
    expect(starsForAnswer(true, 7.5, 8, false)).toBe(1);
    expect(starsForAnswer(true, 20, 8, false)).toBe(1);
    expect(starsForAnswer(false, 1, 8, false)).toBe(0);
    expect(starsForAnswer(true, 1, 8, true)).toBe(0);
  });

  it("computes the 0–1000 score and levels", () => {
    expect(sessionScore(0, 0, 0)).toBe(0);
    expect(sessionScore(5, 5, 15)).toBe(1000);
    expect(sessionScore(5, 3, 6)).toBe(500);
    expect(levelForScore(1000)).toBe("All-Star");
    expect(levelForScore(800)).toBe("All-Star");
    expect(levelForScore(799)).toBe("Varsity");
    expect(levelForScore(600)).toBe("Varsity");
    expect(levelForScore(400)).toBe("Starter");
    expect(levelForScore(399)).toBe("Bench");
  });

  it("titles feedback like legacy", () => {
    expect(feedbackTitle(0, false, true)).toEqual({ title: "Time!", tone: "miss" });
    expect(feedbackTitle(0, false, false)).toEqual({ title: "Miss", tone: "miss" });
    expect(feedbackTitle(3, true, false).title).toBe("Quick!");
    expect(feedbackTitle(2, true, false).title).toBe("Solid");
    expect(feedbackTitle(1, true, false).title).toBe("Got it");
  });
});

describe("phases", () => {
  it("runs setup → feedback in order", () => {
    expect(PHASES[0]).toBe("setup");
    expect(nextPhase("decide")).toBe("outcome");
    expect(nextPhase("feedback")).toBeNull();
    expect(canTransition("freeze", "read")).toBe(true);
    expect(canTransition("setup", "decide")).toBe(false);
  });
});

describe("labels", () => {
  it("builds the kid-clear setup line", () => {
    expect(setupLine(byId("force-1b-grounder").gameState)).toBe(
      "1 ball, no strikes, nobody out, runner on 1st",
    );
    expect(outsLabel(1)).toBe("1 out");
    expect(outsLabel(2)).toBe("2 outs");
    expect(countLabel(2, 1)).toBe("2 balls, 1 strike");
    expect(countLabel(0, 2)).toBe("0 balls, 2 strikes");
    expect(runnersLabel({ "1B": false, "2B": false, "3B": false })).toBe("bases empty");
    expect(runnersLabel({ "1B": true, "2B": true, "3B": true })).toBe("bases loaded");
    expect(runnersLabel({ "1B": true, "2B": false, "3B": true })).toBe("runners on 1st and 3rd");
  });
});

describe("queue", () => {
  it("only serves the chosen POV", () => {
    for (const pos of ["SS", "P", "CF"] as const) {
      const q = buildQueue(bank, { ageBand: "12U-14U", position: pos }, createRng(7));
      expect(q.length).toBeGreaterThan(0);
      expect(q.length).toBeLessThanOrEqual(5);
      q.forEach((s) => expect(s.position).toBe(pos));
    }
  });

  it("respects age band, falling back to other bands for the POV only when empty", () => {
    const sit = (id: string, band: "8U-10U" | "12U-14U", position: "LF" | "RF"): Situation => ({
      ...byId("cutoff-lf-score"),
      id,
      position,
      ageBands: [band],
    });
    const custom = [sit("a", "12U-14U", "LF"), sit("b", "8U-10U", "RF")];
    expect(buildQueue(custom, { ageBand: "8U-10U", position: "LF" }, createRng(1))[0]?.id).toBe(
      "a",
    );
    const all = buildQueue(
      [sit("c", "12U-14U", "RF")],
      { ageBand: "8U-10U", position: "C" },
      createRng(1),
    );
    expect(all.map((s) => s.id)).toEqual(["c"]);
  });

  it("prefers tag variety then fills", () => {
    const base = byId("force-ss-dp");
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...base,
      id: `x${i}`,
      tags: i < 2 ? (["cutoff"] as const) : (["force-play"] as const),
    })) as unknown as Situation[];
    const q = buildQueue(many, { ageBand: "8U-10U", position: "SS", length: 5 }, createRng(3));
    expect(q).toHaveLength(5);
    expect(new Set(q.slice(0, 2).flatMap((s) => s.tags)).size).toBe(2);
  });
});

describe("session", () => {
  const mk = (seed = 11) => createSession({ bank, ageBand: "12U-14U", position: "SS", seed });

  it("is deterministic for a seed", () => {
    expect(mk().queue.map((s) => s.id)).toEqual(mk().queue.map((s) => s.id));
    expect(choiceOrder(mk()).map((c) => c.id)).toEqual(choiceOrder(mk()).map((c) => c.id));
    expect(choiceOrder(mk(), 99)).toEqual([]);
  });

  it("plays a full session and summarizes", () => {
    let s = mk();
    const n = s.queue.length;
    let first = true;
    while (!isComplete(s)) {
      const sit = currentSituation(s)!;
      const pick = first
        ? sit.choices.find((c) => !c.correct)!.id
        : sit.choices.find((c) => c.correct)!.id;
      const r = answerCurrent(s, { choiceId: pick, elapsedSec: 1 });
      expect(r.choice.id).toBe(pick);
      expect(r.answer.correct).toBe(!first);
      expect(() => answerCurrent(r.session, { choiceId: pick, elapsedSec: 1 })).toThrow();
      s = isLastPlay(r.session) ? r.session : advance(r.session);
      first = false;
    }
    expect(runningScore(s)).toBe(summarize(s).score);
    const sum = summarize(s);
    expect(sum.plays).toBe(n);
    expect(sum.correct).toBe(n - 1);
    expect(sum.stars).toBe((n - 1) * 3);
    expect(sum.reviewPatterns.length).toBeGreaterThan(0);
    expect(sum.score).toBe(sessionScore(n, n - 1, (n - 1) * 3));
    expect(() => answerCurrent(advance(s), { choiceId: "a", elapsedSec: 1 })).toThrow();
  });

  it("treats timeouts as a miss with a wrong outcome", () => {
    const s = mk();
    const r = answerCurrent(s, { choiceId: null, elapsedSec: 6, timedOut: true });
    expect(r.answer).toMatchObject({ correct: false, stars: 0, timedOut: true, choiceId: null });
    expect(r.choice.correct).toBe(false);
  });

  it("summarizes empty and clean sessions", () => {
    const empty = { ...mk(), queue: [] };
    expect(summarize(empty)).toMatchObject({ plays: 0, accuracyPct: 0, score: 0, level: "Bench" });
    expect(runningScore(mk())).toBe(0);
    expect(summarize(mk()).reviewPatterns).toEqual([]);
  });

  it("restarts with same POV", () => {
    const r = restart(mk(), bank, 5);
    expect(r.position).toBe("SS");
    expect(r.answers).toEqual([]);
  });

  it("resolves choices", () => {
    const sit = byId("force-1b-grounder");
    expect(isCorrectChoice(sit, "b")).toBe(true);
    expect(isCorrectChoice(sit, null)).toBe(false);
    expect(resolvedChoice(sit, "c").id).toBe("c");
    expect(resolvedChoice(sit, null).correct).toBe(false);
    const allRight = { ...sit, choices: sit.choices.map((c) => ({ ...c, correct: true })) };
    expect(resolvedChoice(allRight, null).id).toBe(sit.choices[0]!.id);
  });
});

describe("game state", () => {
  const outcome = (o: Partial<Outcome> & Pick<Outcome, "kind">): Outcome => ({
    caption: "x",
    animation: { ballPath: [], runners: [] },
    ...o,
  });

  it("applies outs, runs and base changes", () => {
    const gs = fromSnapshot(byId("tag-up-ss").gameState);
    const wrong = byId("tag-up-ss").choices.find((c) => !c.correct)!.outcome;
    const { state, events } = applyOutcome(gs, wrong);
    expect(state.score.them).toBe(1);
    expect(state.outs).toBe(2);
    expect(state.runners).toEqual({ "1B": false, "2B": true, "3B": false });
    expect(events).toEqual([
      { type: "run", count: 1 },
      { type: "out", count: 1 },
    ]);
  });

  it("credits offense runs to us", () => {
    const gs = {
      ...initialGameState("offense"),
      runners: { "1B": false, "2B": false, "3B": true },
    };
    const r = applyOutcome(
      gs,
      outcome({
        kind: "run",
        animation: { ballPath: [], runners: [{ from: "3B", to: "home", endState: "score" }] },
      }),
    );
    expect(r.state.score.us).toBe(1);
  });

  it("retires the side on three outs and ends after 7", () => {
    const two = {
      ...initialGameState("defense"),
      outs: 2,
      runners: { "1B": true, "2B": false, "3B": false },
    };
    const r = applyOutcome(two, outcome({ kind: "out", batterOut: true }));
    expect(r.state).toMatchObject({ outs: 0, side: "offense", inning: 1 });
    expect(r.state.runners["1B"]).toBe(false);

    const last = { ...initialGameState("offense"), inning: 7, outs: 2 };
    const end = applyOutcome(last, outcome({ kind: "out", batterOut: true }));
    expect(end.state.final).toBe(true);
    expect(end.events.map((e) => e.type)).toContain("game-over");
    expect(applyOutcome(end.state, outcome({ kind: "out", batterOut: true })).events).toEqual([]);

    const mid = applyOutcome({ ...last, inning: 3 }, outcome({ kind: "out", batterOut: true }));
    expect(mid.state).toMatchObject({ inning: 4, side: "defense", final: false });
  });

  it("applies every bank outcome without throwing", () => {
    for (const s of bank) {
      for (const c of s.choices) {
        const r = applyOutcome(fromSnapshot(s.gameState), c.outcome);
        expect(r.state.outs).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
