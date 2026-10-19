# ADR 0001 — pnpm + Turborepo monorepo in the existing repo

- **Status:** accepted
- **Date:** 2026-10-19

## Context

The prototype was a single 1,400-line `app.js` mixing data, rules, animation and UI. Train, Play
and Coach modes need to share the same rules and field, and AI agents need clear boundaries.

## Decision

One repo, pnpm workspaces, Turborepo task runner. `apps/web` plus `packages/{content, engine,
field, ui, data}`. Packages export TypeScript source directly (no build step); Vite bundles the
app. The prototype moves to `legacy/prototype/` and is frozen.

## Consequences

- Cross-package refactors are atomic; one CI pipeline.
- Package boundaries are enforced by review, ESLint (DOM globals banned in engine/content) and the
  repo map in `AGENTS.md`.
- Native apps later (Capacitor) reuse `apps/web`.
