# Design system

**Status:** the app ships the legacy (score-era, pre-mock) look, ported verbatim into
`packages/ui/src/app.css`. Phase 4 replaces it with the mockup art direction through tokens and
`packages/field`, guarded by visual tests.

## Tokens (current)

Source of truth: `packages/ui/src/tokens.ts` (TS consumers, SVG) and `packages/ui/src/tokens.css`
(CSS custom properties). Change both together and update this table.

| Token        | CSS var          | Value               | Use                            |
| ------------ | ---------------- | ------------------- | ------------------------------ |
| bgDeep       | `--bg-deep`      | `#071a14`           | page background, runner stroke |
| bgField      | `--bg-field`     | `#0d2f24`           | field panel                    |
| bgPanel      | `--bg-panel`     | `#12382c`           | cards, choices                 |
| chalk        | `--chalk`        | `#e8efe6`           | text, bases, ball              |
| chalkDim     | `--chalk-dim`    | `#9db5a8`           | secondary text                 |
| lime         | `--lime`         | `#b8e23a`           | primary action, "you" spot     |
| limeHot      | `--lime-hot`     | `#d4ff5a`           | highlights                     |
| amber        | `--amber`        | `#f0a020`           | runners, urgent clock          |
| danger       | `--danger`       | `#e85d4c`           | wrong, out, critical clock     |
| ok           | `--ok`           | `#5ecf8a`           | correct, run scored            |
| dirt         | —                | `#c4a574 → #9a7a4f` | infield gradient (SVG)         |
| font display | `--font-display` | Bebas Neue          | headings, score                |
| font body    | `--font-body`    | Manrope             | everything else                |
| radius       | `--radius`       | 14px                | cards/buttons                  |

## Rules

- Tap targets ≥ 44px (asserted in the Playwright smoke test for choices).
- Body type readable for 8U; never below 14px for prompts/choices.
- Motion: the drill honors `prefers-reduced-motion` by running beats 2× faster (no extra motion);
  a user-facing toggle is planned.
- Field art: everything on the diamond is SVG in a 0–100 viewBox; coordinates live in
  `packages/field/src/geometry.ts`. Labels and hit targets must stay exact.

## Target (phase 4)

The mockups are the design target: rounded outfield with a lime fence arc, tan dirt infield, white
chalk and bases, pitcher oval, position bubbles on dark green. References are in the project store
(`field-artboard-ref.jpg`, `drill-graphics-mock.jpg`, `mock-0*.jpg`). Apply them via tokens and
the `field` scene; land them behind visual-regression snapshots of Home, Position, Drill (decide)
and Summary at 390px.
