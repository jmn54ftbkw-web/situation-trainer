## What & why

<!-- One or two sentences. Link the issue / roadmap item. -->

## How to verify

<!-- Commands, URLs, or steps. For UI: open the Pages preview on a phone. -->

## Screenshots (required for UI changes)

<!-- 390px wide. `SCREENSHOT_DIR=$PWD/shots pnpm --filter @st/web exec playwright test screenshots` -->

## Definition of done

- [ ] CI green (typecheck, lint, format, content validation, unit + coverage, build, size, Playwright)
- [ ] Tests added or updated for the change
- [ ] Docs touched where behavior/contracts changed (`AGENTS.md`, `docs/`, ADR if a contract changed)
- [ ] Situations edited only with `pnpm content:validate` passing
- [ ] Design tokens changed only with `docs/design-system.md` updated
- [ ] Checked the deployed/preview app at phone width
