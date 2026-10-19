# ADR 0004 — Progress storage behind an adapter

- **Status:** accepted
- **Date:** 2026-10-19

## Context

v1 has no backend. Accounts and teams (Supabase) come later, and players can be under 13.

## Decision

`@st/data` defines `ProgressStore` (`saveSession`, `listSessions`, `getPreferences`,
`setPreferences`, `clear`). v1 uses `LocalProgressStore` (localStorage, best-effort, falls back
to memory). `createSupabaseProgressStore` is a stub that throws until phase 6. UI code depends only
on the interface.

Stored records contain no personal data: age band, position, counts, score, level, situation ids,
timestamp.

## Consequences

- Swapping in Supabase is an adapter change plus sign-in screens; the engine and screens don't
  change.
- Before accounts ship: COPPA plan — parent/coach-managed profiles, no direct child sign-up, data
  minimization, deletion path.
