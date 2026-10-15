# Situation Trainer

Phone-friendly static prototype for a solo fastpitch situation drill.

Open **https://jmn54ftbkw-web.github.io/situation-trainer/** on a phone, or clone this repo and serve the files:

```bash
python3 -m http.server 8765
```

Then visit http://127.0.0.1:8765/

## Flow

Home → pick age band → pick position → setup → pitch → freeze → read → choose → stars + explanation → session summary.

## Files

| File | Role |
|------|------|
| `index.html` | Screens shell |
| `styles.css` | Sports-training UI |
| `app.js` | Drill loop, timer, scoring, diamond |
| `situations.js` | Authored sample situations |
