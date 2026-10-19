import type { SessionSummary } from "@st/engine";
import { Screen } from "./Screen.tsx";

export function SummaryScreen({
  summary,
  onAgain,
  onChangePosition,
  onHome,
}: {
  summary: SessionSummary;
  onAgain: () => void;
  onChangePosition: () => void;
  onHome: () => void;
}) {
  return (
    <Screen id="summary" label="Session summary">
      <div className="summary-hero">
        <p className="level-label" id="sum-level">
          {summary.level}
        </p>
        <div className="session-score" id="sum-score">
          {summary.score}
        </div>
        <p className="score-blurb">Stars decay with the clock — keep answering early.</p>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="val" id="sum-stars">
            {summary.stars}
          </div>
          <span className="lbl">Stars</span>
        </div>
        <div className="stat">
          <div className="val" id="sum-accuracy">
            {summary.accuracyPct}%
          </div>
          <span className="lbl">Accuracy</span>
        </div>
      </div>
      <p className="section-label">
        Correct ·{" "}
        <span id="sum-correct">
          {summary.correct} / {summary.plays}
        </span>
      </p>
      <p className="section-label" style={{ marginTop: 14 }}>
        Patterns to review
      </p>
      <ul className="patterns" id="patterns">
        {summary.reviewPatterns.length === 0 ? (
          <li>
            <strong>Clean session.</strong> Keep mixing positions next time to stretch new reads.
          </li>
        ) : (
          summary.reviewPatterns.map((p) => (
            <li key={p}>
              Review: <strong>{p}</strong>
            </li>
          ))
        )}
      </ul>
      <div className="footer-cta" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" className="btn btn-primary" id="btn-again" onClick={onAgain}>
          Same position again
        </button>
        <button type="button" className="btn btn-ghost" id="btn-change-pos" onClick={onChangePosition}>
          Change position
        </button>
        <button type="button" className="btn btn-ghost" id="btn-home" onClick={onHome}>
          Home
        </button>
      </div>
    </Screen>
  );
}
