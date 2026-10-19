import type { AgeBand, Position } from "@st/content";
import { Screen } from "./Screen.tsx";

/** Diamond order for a11y / DOM: OF → middle → corners → battery. */
const ORDER: Position[] = ["LF", "CF", "RF", "SS", "2B", "3B", "1B", "P", "C"];

export function PositionScreen({
  ageBand,
  position,
  onPick,
  onBack,
  onBegin,
}: {
  ageBand: AgeBand;
  position: Position | null;
  onPick: (p: Position) => void;
  onBack: () => void;
  onBegin: () => void;
}) {
  return (
    <Screen id="position" label="Pick position">
      <div className="top-bar">
        <h2>Your spot</h2>
        <button type="button" className="linkish" id="btn-back-home" onClick={onBack}>
          Back
        </button>
      </div>
      <p className="section-label">
        Band · <span id="pos-age">{ageBand}</span>
      </p>
      <div
        className="pos-field"
        id="pos-field"
        role="group"
        aria-label="Pick position on the field"
      >
        {ORDER.map((pos) => (
          <button
            key={pos}
            type="button"
            data-pos={pos}
            aria-label={`Position ${pos}`}
            aria-pressed={position === pos}
            className={position === pos ? "selected" : undefined}
            onClick={() => onPick(pos)}
          >
            {pos}
          </button>
        ))}
      </div>
      <p className="pos-hint">Tap your spot on the diamond. Situations filter to that position.</p>
      <div className="footer-cta">
        <button
          type="button"
          className="btn btn-primary"
          id="btn-begin"
          disabled={!position}
          onClick={onBegin}
        >
          Begin session
        </button>
      </div>
    </Screen>
  );
}
