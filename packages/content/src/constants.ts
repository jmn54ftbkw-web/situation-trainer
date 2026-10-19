// Runtime constants shared by schema, engine, field and UI. Keep zod out of this file so the
// app bundle never pulls in the schema library.

export const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_NAMES: Record<Position, string> = {
  P: "Pitcher",
  C: "Catcher",
  "1B": "First base",
  "2B": "Second base",
  "3B": "Third base",
  SS: "Shortstop",
  LF: "Left field",
  CF: "Center field",
  RF: "Right field",
};

export const AGE_BANDS = ["8U-10U", "12U-14U"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const SIDES = ["defense", "offense"] as const;
export type Side = (typeof SIDES)[number];

export const BASES = ["1B", "2B", "3B"] as const;
export type Base = (typeof BASES)[number];

/** Named spots on the field diagram that ball paths and runners can reference. */
export const FIELD_SPOTS = [
  "home",
  "1B",
  "2B",
  "3B",
  "P",
  "C",
  "SS",
  "LF",
  "CF",
  "RF",
  "cutoff-home",
  "cutoff-3B",
  "mound-1B",
  "SS-LF",
  "backstop",
  "gap",
] as const;
export type FieldSpot = (typeof FIELD_SPOTS)[number];

export const BALL_TYPES = [
  "grounder",
  "bunt",
  "wild-pitch",
  "single",
  "gap",
  "line",
  "popup",
  "fly",
  "steal",
] as const;
export type BallType = (typeof BALL_TYPES)[number];

export const RUNNER_TIMINGS = ["with-ball", "after-catch", "delayed"] as const;
export type RunnerTiming = (typeof RUNNER_TIMINGS)[number];

export const RUNNER_END_STATES = ["out", "safe", "score", "hold"] as const;
export type RunnerEndState = (typeof RUNNER_END_STATES)[number];

/** What a choice does to the game. Play mode keys its outcome tables off this. */
export const OUTCOME_KINDS = ["out", "safe", "run", "error", "hit", "steal", "none"] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

export const TAGS = [
  "force-play",
  "cutoff",
  "priority",
  "bunt-defense",
  "tagging-up",
  "backup",
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  "force-play": "Force plays",
  cutoff: "Cutoffs / relays",
  priority: "Pop-up priority",
  "bunt-defense": "Bunt defense",
  "tagging-up": "Tagging up",
  backup: "Backup responsibilities",
};

export const REVIEW_STATUSES = ["draft", "reviewed", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SCHEMA_VERSION = 1;
