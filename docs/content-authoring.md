# Content authoring

Situations live in `packages/content/situations/<id>.json`, one file per item, file name = `id`.
The schema is `packages/content/src/schema.ts` (ADR 0003).

```bash
pnpm content:index      # after adding/removing a file
pnpm content:validate   # always, before committing
```

## Template

```json
{
  "id": "force-1b-grounder",
  "version": 1,
  "schemaVersion": 1,
  "ageBands": ["8U-10U", "12U-14U"],
  "position": "1B",
  "side": "defense",
  "gameState": {
    "inning": 2,
    "outs": 0,
    "balls": 1,
    "strikes": 0,
    "runners": { "1B": true, "2B": false, "3B": false }
  },
  "sequence": {
    "pitch": true,
    "ball": { "type": "grounder", "from": "home", "region": "1B" },
    "runnerMotion": [{ "from": "1B", "to": "2B", "timing": "with-ball" }],
    "freeze": { "mode": "after" }
  },
  "prompt": "Grounder right at you. Runner on first. Where do you throw?",
  "choices": [
    {
      "id": "b",
      "label": "Second base (force)",
      "correct": true,
      "outcome": {
        "kind": "out",
        "caption": "Flip to second — force out!",
        "animation": {
          "ballPath": [{ "to": "2B", "kind": "throw" }],
          "runners": [{ "from": "1B", "to": "2B", "endState": "out" }]
        }
      }
    }
  ],
  "explanation": "With a runner on first and fewer than two outs, the force at second is the sure out.",
  "tags": ["force-play"],
  "difficulty": 1,
  "reviewStatus": "draft"
}
```

Field spots for `ball.from/region/throwTo` and `ballPath[].to`: bases (`home`, `1B`, `2B`, `3B`),
positions (`P`, `C`, `SS`, `LF`, `CF`, `RF`), and `cutoff-home`, `cutoff-3B`, `mound-1B`, `SS-LF`,
`backstop`, `gap`.

## Rules the validator enforces

- Schema shape (strict — unknown keys fail).
- **One POV**: `position` is a single value, and the prompt may not address another position
  ("Right field — …", "As the catcher…", "You're the shortstop…").
- At least one correct choice; unique choice ids and labels.
- **Shuffle-safe** labels: no "all/none of the above", "above/below", "A)" prefixes.
- Every choice has an `outcome`; runners only move from occupied bases (or `home` for the batter).
- `freeze.at` only with `mode: "in-flight"`.
- File name matches `id`; `bank.generated.ts` is up to date.

## Writing for 8U–14U

- **8U–10U**: short sentences, concrete words ("throw to second"), one idea per prompt, no
  jargon without the plain version ("force — the runner has to run").
- **12U–14U**: can use cutoff/relay, tag-up, priority language; may include score/inning context.
- Prompts ≤ 160 chars; labels ≤ 90 chars; explanation 1–2 sentences that teach the _why_.
- Address the player as "you" — the POV player is the one deciding.

## Position-specific variants

When the same play matters for several positions, write **one item per POV** with its own id
(`<play>-<pos>`, e.g. `bunt-3b-charge`, `bunt-p-cover-1b`). Same `gameState` and `sequence`; change
`position`, `prompt`, `choices`, outcomes and explanation to what _that_ player does. Never tag one
prompt to several positions.

## QA checklist

- [ ] Prompt addresses only `position`, and the correct answer is right for that player.
- [ ] Count/outs/runners match the prompt and the animation.
- [ ] Every wrong choice's outcome shows a believable consequence.
- [ ] Explanation teaches the reason, kid-readable.
- [ ] Choices make sense in any order.
- [ ] `reviewNotes` captures open coach questions; set `reviewStatus` to `reviewed` only after a
      coach read-through, `approved` after it has shipped cleanly.
- [ ] `pnpm content:validate` passes.

## Migration note

The 17 prototype items were converted by `pnpm --filter @st/content migrate:legacy`
(`src/cli/migrate-legacy.ts`). Multi-position legacy tags were collapsed to the POV the prompt
addresses; the dropped positions are recorded in each item's `reviewNotes` for the phase-3
position-true split.
