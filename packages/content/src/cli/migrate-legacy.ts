/**
 * One-shot migration of legacy/prototype/situations.js into schema-v1 JSON files.
 * Kept in the repo so the transform is reviewable and repeatable; re-running overwrites
 * situations/<id>.json for the legacy ids only.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import type { Position } from "../constants.ts";
import type { Outcome, Situation } from "../schema.ts";
import { REPO_ROOT, SITUATIONS_DIR } from "./paths.ts";

interface LegacyOutcome {
  caption?: string;
  completeToLanding?: boolean;
  drop?: boolean;
  ballPath?: { to: string; kind?: string }[];
  runners?: { from: string; to?: string; endState?: string }[];
}

interface LegacySituation {
  id: string;
  ageBands: string[];
  positions: string[];
  tags: string[];
  outs: number;
  balls?: number;
  strikes?: number;
  inning?: number;
  scoreDiff?: number;
  runners?: Partial<Record<"1B" | "2B" | "3B", boolean>>;
  runnerMotion?: { from: string; to: string; timing?: string }[];
  freeze?: string;
  freezeAt?: number;
  ball: { type: string; region: string; from?: string; throwTo?: string; pitch?: boolean };
  prompt: string;
  choices: { id: string; label: string }[];
  correctChoiceIds: string[];
  explanation: string;
  outcomeCorrect?: LegacyOutcome;
  outcomeWrong?: LegacyOutcome;
}

/**
 * Legacy items were tagged for several positions but the prompt only ever addresses one
 * player. This table picks the POV the prompt actually speaks to (single-POV rule).
 */
const POV: Record<string, { position: Position; note?: string }> = {
  "force-1b-grounder": { position: "1B" },
  "force-ss-dp": { position: "SS", note: "Legacy also tagged 2B; ball is hit to SS." },
  "cutoff-lf-score": { position: "LF", note: "Legacy also tagged CF; single is to LF." },
  "cutoff-rf-extra": { position: "RF", note: "Legacy also tagged CF; ball is to the RF side." },
  "popup-priority-p": {
    position: "P",
    note: "Legacy also tagged C, 1B. Pitcher POV: learn to give way to 1B.",
  },
  "popup-priority-ss": { position: "SS", note: "Legacy also tagged 3B, LF." },
  "bunt-3b-charge": { position: "3B", note: "Legacy also tagged P, C; bunt is toward third." },
  "bunt-c-cover": { position: "C" },
  "tag-up-cf": { position: "CF", note: "Legacy also tagged LF, RF; fly is to CF." },
  "tag-up-ss": { position: "SS", note: "Legacy also tagged 2B, P; prompt says middle infield." },
  "backup-p-wp": {
    position: "P",
    note: "Legacy also tagged 1B, 3B; choices reference the rubber.",
  },
  "backup-rf-throw": { position: "RF", note: "Legacy also tagged 1B, C; prompt addresses RF." },
  "force-2b-cover": {
    position: "SS",
    note: "Legacy id says 2B, but on a grounder to 1B the shortstop covers second. Needs a 2B-true variant (2B covers first).",
  },
  "ss-steal-cover": {
    position: "2B",
    note: "Legacy also tagged SS, C. Assigned to 2B so 2B has a POV item; steal coverage varies by team — coach review.",
  },
  "p-comebacker-force": { position: "P" },
  "lf-backup-3b": { position: "LF", note: "Legacy also tagged 3B; prompt addresses LF." },
  "cf-shallow-priority": { position: "CF", note: "Legacy also tagged SS, 2B." },
};

function outcomeKind(o: LegacyOutcome, ballType: string): Outcome["kind"] {
  const rs = o.runners ?? [];
  if (o.drop) return "error";
  if (rs.some((r) => r.endState === "score")) return "run";
  if (rs.some((r) => r.endState === "out")) return "out";
  if ((ballType === "popup" || ballType === "fly") && !o.drop) return "out";
  if (ballType === "steal" && rs.some((r) => r.endState === "safe")) return "steal";
  if (rs.some((r) => r.endState === "safe" && r.from !== r.to)) return "safe";
  return "none";
}

function convertOutcome(o: LegacyOutcome | undefined, ballType: string, correct: boolean): Outcome {
  const src = o ?? {};
  const kind = outcomeKind(src, ballType);
  const caught = (ballType === "popup" || ballType === "fly") && !src.drop;
  const out: Outcome = {
    kind,
    caption: src.caption ?? (correct ? "Nice call — finish the play!" : "Here's what happened…"),
    animation: {
      ballPath: (src.ballPath ?? []).map((s) => ({
        to: s.to as Outcome["animation"]["ballPath"][number]["to"],
        kind: (s.kind ?? "throw") as "throw" | "hit",
      })),
      runners: (src.runners ?? []).map((r) => ({
        from: r.from as "home" | "1B" | "2B" | "3B",
        to: (r.to ?? r.from) as "1B" | "2B" | "3B" | "home",
        endState: (r.endState ?? "safe") as "out" | "safe" | "score" | "hold",
      })),
    },
  };
  if (caught) out.batterOut = true;
  if (src.drop) out.animation.drop = true;
  if (src.completeToLanding === false) out.animation.completeToLanding = false;
  return out;
}

function convert(l: LegacySituation): Situation {
  const pov = POV[l.id];
  if (!pov) throw new Error(`No POV mapping for legacy id ${l.id}`);
  const inFlight = l.freeze === "in-flight";
  const s: Situation = {
    id: l.id,
    version: 1,
    schemaVersion: 1,
    ageBands: l.ageBands as Situation["ageBands"],
    position: pov.position,
    side: "defense",
    gameState: {
      inning: l.inning ?? 1,
      outs: l.outs,
      balls: l.balls ?? 0,
      strikes: l.strikes ?? 0,
      runners: {
        "1B": !!l.runners?.["1B"],
        "2B": !!l.runners?.["2B"],
        "3B": !!l.runners?.["3B"],
      },
    },
    sequence: {
      pitch: l.ball.pitch !== false,
      ball: {
        type: l.ball.type as Situation["sequence"]["ball"]["type"],
        from: (l.ball.from ?? "home") as Situation["sequence"]["ball"]["from"],
        region: l.ball.region as Situation["sequence"]["ball"]["region"],
      },
      runnerMotion: (l.runnerMotion ?? []).map((m) => ({
        from: m.from as "home" | "1B" | "2B" | "3B",
        to: m.to as "1B" | "2B" | "3B" | "home",
        timing: (m.timing ?? "with-ball") as "with-ball" | "after-catch" | "delayed",
      })),
      freeze: inFlight
        ? { mode: "in-flight", ...(l.freezeAt !== undefined ? { at: l.freezeAt } : {}) }
        : { mode: "after" },
    },
    prompt: l.prompt,
    choices: l.choices.map((c) => {
      const correct = l.correctChoiceIds.includes(c.id);
      return {
        id: c.id,
        label: c.label,
        correct,
        outcome: convertOutcome(correct ? l.outcomeCorrect : l.outcomeWrong, l.ball.type, correct),
      };
    }),
    explanation: l.explanation,
    tags: l.tags as Situation["tags"],
    difficulty: l.ageBands.includes("8U-10U") ? 1 : 2,
    reviewStatus: "draft",
  };
  if (l.scoreDiff !== undefined) s.gameState.scoreDiff = l.scoreDiff;
  if (l.ball.throwTo) {
    s.sequence.ball.throwTo = l.ball.throwTo as Situation["sequence"]["ball"]["region"];
  }
  if (pov.note) s.reviewNotes = pov.note;
  return s;
}

const legacyFile = join(REPO_ROOT, "legacy/prototype/situations.js");
const sandbox: { window: { SITUATIONS?: LegacySituation[] } } = { window: {} };
runInNewContext(readFileSync(legacyFile, "utf8"), sandbox);
const legacy = sandbox.window.SITUATIONS ?? [];

mkdirSync(SITUATIONS_DIR, { recursive: true });
for (const l of legacy) {
  writeFileSync(join(SITUATIONS_DIR, `${l.id}.json`), JSON.stringify(convert(l), null, 2) + "\n");
}
console.log(`Migrated ${legacy.length} legacy situations`);
