# ADR 0002 — The engine is pure and deterministic

- **Status:** accepted
- **Date:** 2026-10-19

## Context

Scoring, timers and outcome rules must be identical across Train, Play and any future native
shell, and must be testable without a browser.

## Decision

`@st/engine` is plain TypeScript with no DOM, no timers and no `Math.random`. Randomness comes
from `createRng(seed)`; functions return new values instead of mutating. The UI owns wall-clock
time and passes elapsed seconds in. Animation math in `@st/field` follows the same rule
(`samplePlay(timeline, ms)` is pure); only `FieldPlayer` touches the DOM.

## Consequences

- Same seed ⇒ same session, so e2e tests and bug reports are reproducible (`?seed=`).
- Coverage gate ≥ 90% on the engine is cheap to hold.
- React components never decide correctness, stars or score.
