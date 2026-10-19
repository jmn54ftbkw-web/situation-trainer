import { z } from "zod";
import {
  AGE_BANDS,
  BALL_TYPES,
  FIELD_SPOTS,
  OUTCOME_KINDS,
  POSITIONS,
  REVIEW_STATUSES,
  RUNNER_END_STATES,
  RUNNER_TIMINGS,
  SCHEMA_VERSION,
  SIDES,
  TAGS,
} from "./constants.ts";

/** Where a runner can start: a base, or "home" for the batter-runner. */
const RunnerFrom = z.enum(["home", "1B", "2B", "3B"]);
const RunnerTo = z.enum(["1B", "2B", "3B", "home"]);

export const RunnersSchema = z
  .object({
    "1B": z.boolean(),
    "2B": z.boolean(),
    "3B": z.boolean(),
  })
  .strict();

export const GameStateSnapshotSchema = z
  .object({
    inning: z.number().int().min(1).max(7),
    outs: z.number().int().min(0).max(2),
    balls: z.number().int().min(0).max(3),
    strikes: z.number().int().min(0).max(2),
    runners: RunnersSchema,
    /** Our runs minus theirs, from the POV team's side. Optional context for the prompt. */
    scoreDiff: z.number().int().optional(),
  })
  .strict();

export const BallSchema = z
  .object({
    type: z.enum(BALL_TYPES),
    from: z.enum(FIELD_SPOTS),
    region: z.enum(FIELD_SPOTS),
    throwTo: z.enum(FIELD_SPOTS).optional(),
  })
  .strict();

export const RunnerMotionSchema = z
  .object({
    from: RunnerFrom,
    to: RunnerTo,
    timing: z.enum(RUNNER_TIMINGS),
  })
  .strict();

export const FreezeSchema = z
  .object({
    /** "after" = question once the play is over; "in-flight" = freeze mid ball/throw. */
    mode: z.enum(["after", "in-flight"]),
    /** 0..1 along the action leg; only for in-flight. Engine clamps to 0.35–0.85. */
    at: z.number().min(0.35).max(0.85).optional(),
  })
  .strict();

export const SequenceSchema = z
  .object({
    /** Animate P → plate before the action. */
    pitch: z.boolean(),
    ball: BallSchema,
    runnerMotion: z.array(RunnerMotionSchema),
    freeze: FreezeSchema,
  })
  .strict();

export const BallPathStepSchema = z
  .object({
    to: z.enum(FIELD_SPOTS),
    kind: z.enum(["throw", "hit"]),
  })
  .strict();

export const OutcomeRunnerSchema = z
  .object({
    from: RunnerFrom,
    to: RunnerTo,
    endState: z.enum(RUNNER_END_STATES),
  })
  .strict();

export const OutcomeSchema = z
  .object({
    kind: z.enum(OUTCOME_KINDS),
    caption: z.string().min(1).max(80),
    /** True when the batter is retired without a runner mark (e.g. a caught fly). */
    batterOut: z.boolean().optional(),
    animation: z
      .object({
        /** Finish the frozen ball's flight before the outcome path (default true). */
        completeToLanding: z.boolean().optional(),
        /** Ball drops to the dirt (missed catch). */
        drop: z.boolean().optional(),
        ballPath: z.array(BallPathStepSchema),
        runners: z.array(OutcomeRunnerSchema),
      })
      .strict(),
  })
  .strict();

export const ChoiceSchema = z
  .object({
    id: z.string().regex(/^[a-z]$/),
    label: z.string().min(1).max(90),
    correct: z.boolean(),
    outcome: OutcomeSchema,
  })
  .strict();

export const SituationSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    version: z.number().int().min(1),
    schemaVersion: z.literal(SCHEMA_VERSION),
    ageBands: z.array(z.enum(AGE_BANDS)).min(1),
    /** Exactly one point of view. The prompt must address this player. */
    position: z.enum(POSITIONS),
    side: z.enum(SIDES),
    gameState: GameStateSnapshotSchema,
    sequence: SequenceSchema,
    prompt: z.string().min(10).max(160),
    choices: z.array(ChoiceSchema).min(2).max(4),
    explanation: z.string().min(20).max(320),
    tags: z.array(z.enum(TAGS)).min(1),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    reviewStatus: z.enum(REVIEW_STATUSES),
    reviewNotes: z.string().optional(),
  })
  .strict();

export type Runners = z.infer<typeof RunnersSchema>;
export type GameStateSnapshot = z.infer<typeof GameStateSnapshotSchema>;
export type Ball = z.infer<typeof BallSchema>;
export type RunnerMotion = z.infer<typeof RunnerMotionSchema>;
export type Freeze = z.infer<typeof FreezeSchema>;
export type Sequence = z.infer<typeof SequenceSchema>;
export type BallPathStep = z.infer<typeof BallPathStepSchema>;
export type OutcomeRunner = z.infer<typeof OutcomeRunnerSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type Choice = z.infer<typeof ChoiceSchema>;
export type Situation = z.infer<typeof SituationSchema>;
