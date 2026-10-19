# ADR 0003 — Situation schema v1

- **Status:** accepted
- **Date:** 2026-10-19

## Context

Legacy items listed several `positions` for one prompt, so a catcher could get "Right field — what
do you do?". Outcomes existed only as one `outcomeCorrect` and one `outcomeWrong`, which Play mode
cannot use to change the game.

## Decision

Zod schema in `packages/content/src/schema.ts`, `schemaVersion: 1`:

- `position`: exactly one POV; the validator also rejects prompts that address another position.
- `side`: `defense` | `offense` (all current items are defense).
- `gameState`: inning, outs, balls, strikes, runners (`1B/2B/3B` booleans), optional `scoreDiff`.
- `sequence`: `pitch`, `ball` (type, from, region, throwTo), `runnerMotion[]`, `freeze`.
- `choices[]` (2–4), each with `correct` and its own `outcome`:
  `kind` (`out | safe | run | error | hit | steal | none`), `caption`, optional `batterOut`, and
  `animation` (ball path + runner end states).
- `explanation`, `tags`, `difficulty` (1–3), `reviewStatus` (`draft | reviewed | approved`),
  optional `reviewNotes`, and per-item `version`.

JSON files are validated in CI; the app imports a generated index with type-only schema imports so
Zod is not shipped to players.

## Consequences

- The 17 legacy items were migrated by script. Collapsing to one POV left 2B, 1B, 3B and C with one
  item each; phase 3 adds position-true variants.
- Adding a field is a contract change: bump `schemaVersion` or make it optional, update the
  validator, the authoring guide and this ADR's successor.
