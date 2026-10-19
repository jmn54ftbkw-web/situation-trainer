import { AGE_BANDS, type AgeBand } from "@st/content";
import { Screen } from "./Screen.tsx";

const bandLabel = (b: AgeBand) => b.replace("-", "–");

export function HomeScreen({
  ageBand,
  onAgeBand,
  onStart,
}: {
  ageBand: AgeBand;
  onAgeBand: (b: AgeBand) => void;
  onStart: () => void;
}) {
  return (
    <Screen id="home" label="Home">
      <div className="home-hero">
        <svg className="home-mark" viewBox="0 0 100 100" aria-hidden="true">
          <polygon
            points="50,90 80,58 50,26 20,58"
            fill="none"
            stroke="#b8e23a"
            strokeWidth="2"
          />
          <circle cx="50" cy="62" r="4" fill="#b8e23a" opacity="0.5" />
        </svg>
        <p className="section-label">Fastpitch · 8U–14U</p>
        <h1 className="brand">
          Situation
          <span>Trainer</span>
        </h1>
        <p className="tagline">Read the play. Decide under the clock. Earn stars for speed.</p>
      </div>
      <div className="home-controls">
        <div>
          <p className="section-label">Age band</p>
          <div className="seg" id="age-seg" role="group" aria-label="Age band">
            {AGE_BANDS.map((b) => (
              <button
                key={b}
                type="button"
                className={b === ageBand ? "selected" : undefined}
                aria-pressed={b === ageBand}
                data-age={b}
                onClick={() => onAgeBand(b)}
              >
                {bandLabel(b)}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary" id="btn-start" onClick={onStart}>
          Start practice
        </button>
      </div>
    </Screen>
  );
}
