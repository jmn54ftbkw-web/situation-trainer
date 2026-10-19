import { useEffect, useState } from "react";
import { feedbackTitle } from "@st/engine";
import type { LastAnswer } from "../App.tsx";
import { Screen } from "./Screen.tsx";

export function FeedbackScreen({
  last,
  isLast,
  onNext,
}: {
  last: LastAnswer;
  isLast: boolean;
  onNext: () => void;
}) {
  const { answer, situation } = last;
  const { title, tone } = feedbackTitle(answer.stars, answer.correct, answer.timedOut);
  const [lit, setLit] = useState(0);
  const [explainIn, setExplainIn] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setExplainIn(true));
    const timers = Array.from({ length: answer.stars }, (_, i) =>
      setTimeout(() => setLit(i + 1), 80 + i * 90),
    );
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [answer.stars]);

  return (
    <Screen id="feedback" label="Feedback">
      <div className="summary-hero">
        <h2 className={`feedback-title ${tone}`} id="feedback-title">
          {title}
        </h2>
        <div className="stars" id="stars" aria-label={`Stars earned: ${answer.stars}`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`star${i < lit ? " on star-pop" : ""}`} />
          ))}
        </div>
      </div>
      <p className={`explanation${explainIn ? " explain-in" : ""}`} id="explanation">
        {situation.explanation}
      </p>
      <div className="footer-cta">
        <button type="button" className="btn btn-primary" id="btn-next" onClick={onNext}>
          {isLast ? "See session summary" : "Next situation"}
        </button>
      </div>
    </Screen>
  );
}
