# Roadmap

| Phase               | Scope                                                                               | Status                                   |
| ------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| 1. Foundation       | Monorepo, tooling, CI/deploy, AGENTS.md, docs, ADRs 0001–0004                       | Done (`platform-foundation`)             |
| 2. Port Train mode  | Rebuild the score-era prototype on the packages; retire legacy from the root        | Done — legacy kept at `/legacy/`         |
| 3. Content system   | Split the 17 items into position-true variants; grow toward ~100 with review status | Next — 2B/1B/3B/C have 1 item each today |
| 4. Design system    | Mockup art via tokens + `field`; visual-regression tests                            | Next                                     |
| 5. Play mode        | Inning simulator on `GameState`/`applyOutcome`; offense situations                  | Contract in place                        |
| 6. Accounts & teams | Supabase `ProgressStore`, coach roster, assignments, leaderboards; COPPA plan       | Interface in place                       |

## Known follow-ups

- PWA service worker (offline).
- Visual snapshot assertions (screenshots are captured as CI artifacts today).
- User-facing reduced-motion toggle (OS setting is honored).
- Engine-level session length when a POV has fewer than 5 items for an age band.
