# AGENTS.md — operating manual for AI agents (and humans)

**Situation Trainer** is a fastpitch softball game-IQ trainer for 8U–14U players. A player picks a
position, watches a play from that point of view, freezes, reads a prompt, and answers 2–4 choices
against a clock. Correct + fast = more stars; each session ends with a 0–1000 score and a level.

- **Train mode** (shipped): isolated drills, stars, session score.
- **Play mode** (planned, phase 5): a 7-inning game where each answer's `outcome` changes a
  persistent `GameState` via `applyOutcome`.
- **Accounts/teams** (planned, phase 6): Supabase adapter behind `ProgressStore`. Players can be
  under 13 — no direct child sign-up, no personal data before the COPPA plan lands.

## Repo map

| Path               | What lives there                                                              | May import                    |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------------- |
| `packages/content` | Zod schema, `situations/*.json`, validator + migration CLIs                   | `zod` (schema/CLI only)       |
| `packages/engine`  | Pure TS rules: phases, timers, stars, score, queue, session, `GameState`      | `@st/content` types/constants |
| `packages/field`   | Diamond geometry, play/outcome timelines (pure), SVG scene, DOM `FieldPlayer` | content, ui tokens            |
| `packages/ui`      | Design tokens (`tokens.ts` + `tokens.css`) and the app stylesheet             | —                             |
| `packages/data`    | `ProgressStore` interface; memory/localStorage adapters; Supabase stub        | content types                 |
| `apps/web`         | React + Vite PWA screens (Home, Position, Drill, Feedback, Summary)           | everything above              |
| `legacy/prototype` | Frozen original static app. Reference only; served at `/legacy/`              | —                             |
| `docs/`            | Architecture, authoring guide, design system, roadmap, ADRs                   | —                             |

## Commands

```bash
pnpm install
pnpm dev                 # apps/web on http://localhost:5173
pnpm test                # unit tests (all packages)
pnpm test:coverage       # with coverage gates (engine ≥ 90%)
pnpm typecheck
pnpm lint && pnpm format:check
pnpm content:validate    # schema + single-POV + shuffle-safety + index freshness
pnpm content:index       # regenerate packages/content/src/bank.generated.ts after adding JSON
pnpm test:e2e            # Playwright smoke at 390px against a production build
VITE_BASE=/situation-trainer/ pnpm build && pnpm size
```

URL knobs for QA/tests: `?seed=123` (deterministic session) and `?speed=8` (faster beats; the
decision clock is never scaled).

## Where does my change go?

- A new rule, scoring tweak, timer, or game-state effect → `packages/engine` (+ unit tests).
- A new situation or wording fix → `packages/content/situations/<id>.json`, then
  `pnpm content:index && pnpm content:validate`. See `docs/content-authoring.md`.
- A schema field → `packages/content/src/schema.ts` + validator + ADR (contract change).
- Ball/runner motion or field art → `packages/field` (+ `docs/design-system.md`).
- Colors/type/spacing → `packages/ui` tokens (both `tokens.ts` and `tokens.css`).
- Persistence → a `ProgressStore` adapter in `packages/data`; UI talks only to the interface.
- Screens and wiring → `apps/web`.

## Rules

**Do**

- Keep `packages/engine` and `packages/content/src` DOM-free and deterministic (seeded RNG only).
- Give every situation exactly one `position` (POV) and write the prompt to that player.
- Give every choice its own `outcome` (kind, caption, animation).
- Add or update tests with every behavior change; keep coverage gates green.
- Add an ADR in `docs/adr/` for any change to a package contract.
- Attach 390px screenshots to any PR that changes UI.

**Don't**

- Don't put game rules (scoring, correctness, timers, queue logic) in React components.
- Don't hand-edit a situation without running `pnpm content:validate`.
- Don't edit `bank.generated.ts` by hand.
- Don't bump design tokens without updating `docs/design-system.md`.
- Don't show the score formula to players.
- Don't add features to `legacy/prototype`.
- Don't collect personal data (names, emails, birthdays) in v1.

## Definition of done

CI green (typecheck, lint, format, content validation, unit tests + coverage, build, JS size budget,
Playwright smoke), tests added, docs touched, and the Pages build checked on a phone-width screen.
See `.github/pull_request_template.md`.

## Deploy

`main` → `.github/workflows/deploy.yml` → GitHub Pages (source must be **GitHub Actions**).
The site root serves `apps/web`; the frozen prototype is at `/situation-trainer/legacy/`.
Rollback: set repo variable `DEPLOY_APP=legacy` (or run the workflow manually with `app=legacy`).
