# Legacy prototype (frozen)

The original static prototype (score-era, pre-mock — commit `f848a46`). It is kept for reference
and as a parity target for `apps/web`. **Do not add features here.**

Serve it locally:

```bash
cd legacy/prototype && python3 -m http.server 8765
```

| File | Role |
|------|------|
| `index.html` | Screens shell |
| `styles.css` | Sports-training UI (source of `packages/ui/src/app.css`) |
| `app.js` | Drill loop, timer, scoring, diamond (ported to `packages/engine` + `packages/field`) |
| `situations.js` | Original bank (migrated to `packages/content/situations/*.json`) |
