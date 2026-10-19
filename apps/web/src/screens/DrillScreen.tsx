import { useEffect, useRef, useState } from "react";
import type { Choice } from "@st/content";
import {
  answerCurrent,
  BEATS,
  choiceOrder,
  currentSituation,
  freezeHoldMs,
  PITCH_LINE,
  questionReadMs,
  runningScore,
  setupLine,
  timerSeconds,
  type AnswerRecord,
  type Phase,
  type TrainSession,
} from "@st/engine";
import { FieldPlayer, type FreezeSnapshot } from "@st/field";
import { Screen } from "./Screen.tsx";

const BANNER: Partial<Record<Phase, { text: string; cls: string }>> = {
  setup: { text: "Set", cls: "ask" },
  pitch: { text: "Pitch", cls: "live" },
  play: { text: "Play", cls: "live" },
  freeze: { text: "Freeze", cls: "freeze" },
  read: { text: "Read", cls: "read" },
  decide: { text: "Decide", cls: "ask" },
  outcome: { text: "Finish", cls: "live" },
};

interface Props {
  session: TrainSession;
  speed: number;
  /** Called as soon as the player answers (running score updates during the finish). */
  onAnswered: (s: TrainSession) => void;
  /** Called after the outcome animation. */
  onDone: (s: TrainSession, answer: AnswerRecord) => void;
}

export function DrillScreen({ session, speed, onAnswered, onDone }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const initial = useRef(session).current;
  const sit = currentSituation(initial)!;
  const [order] = useState<Choice[]>(() => choiceOrder(initial));
  const total = timerSeconds(initial.ageBand);

  const [phase, setPhase] = useState<Phase>("setup");
  const [cue, setCue] = useState(() => setupLine(sit.gameState));
  const [showPitchLine, setShowPitchLine] = useState(false);
  const [left, setLeft] = useState(total);
  const [picked, setPicked] = useState<{ id: string | null } | null>(null);

  const ctl = useRef<{
    player: FieldPlayer | null;
    snap: FreezeSnapshot | null;
    startedAt: number;
    locked: boolean;
    cancelled: boolean;
    timers: ReturnType<typeof setTimeout>[];
    interval: ReturnType<typeof setInterval> | null;
  }>({ player: null, snap: null, startedAt: 0, locked: true, cancelled: false, timers: [], interval: null });

  const choose = (choiceId: string | null, timedOut: boolean) => {
    const c = ctl.current;
    if (c.locked) return;
    c.locked = true;
    if (c.interval) clearInterval(c.interval);
    const elapsedSec = (performance.now() - c.startedAt) / 1000;
    const res = answerCurrent(initial, { choiceId, elapsedSec, timedOut });
    setPicked({ id: timedOut ? null : choiceId });
    onAnswered(res.session);
    const lead = timedOut ? BEATS.outcomeLeadTimedOut : BEATS.outcomeLeadAnswered;
    c.timers.push(
      setTimeout(async () => {
        if (c.cancelled || !c.player) return;
        setPhase("outcome");
        setCue(res.choice.outcome.caption);
        setShowPitchLine(false);
        await c.player.playOutcome(sit, res.choice.outcome, c.snap ?? { midFlight: false, ball: { x: 50, y: 62 } });
        if (!c.cancelled) onDone(res.session, res.answer);
      }, lead / speed),
    );
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  useEffect(() => {
    const c = ctl.current;
    c.cancelled = false;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const player = new FieldPlayer(wrap, { speed });
    c.player = player;
    player.mount(sit, initial.position);
    const wait = (ms: number) =>
      new Promise<void>((resolve) => c.timers.push(setTimeout(resolve, ms / speed)));

    (async () => {
      await wait(BEATS.setup);
      if (c.cancelled) return;
      setPhase("pitch");
      setShowPitchLine(true);
      await wait(BEATS.pitchCue);
      if (c.cancelled) return;
      setPhase("play");
      const snap = await player.playSequence(sit);
      if (c.cancelled) return;
      c.snap = snap;
      setPhase("freeze");
      setShowPitchLine(false);
      await wait(freezeHoldMs(snap.midFlight));
      if (c.cancelled) return;
      setPhase("read");
      await wait(questionReadMs(initial.ageBand));
      if (c.cancelled) return;
      setPhase("decide");
      c.locked = false;
      c.startedAt = performance.now();
      c.interval = setInterval(() => {
        const l = Math.max(0, total - (performance.now() - c.startedAt) / 1000);
        setLeft(l);
        if (l <= 0) chooseRef.current(null, true);
      }, 50);
    })();

    return () => {
      c.cancelled = true;
      c.locked = true;
      player.stop();
      c.timers.forEach(clearTimeout);
      c.timers = [];
      if (c.interval) clearInterval(c.interval);
      c.interval = null;
    };
    // Runs once per mounted play; App remounts this screen (keyed) for each situation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const asking = phase === "read" || phase === "decide" || phase === "outcome";
  const veiled = phase !== "decide";
  const pct = Math.max(0, (left / total) * 100);
  const urgent = left <= total * 0.4 && left > total * 0.2;
  const critical = left <= total * 0.2;
  const timeCls = critical ? " critical" : urgent ? " urgent" : "";
  const banner = BANNER[phase];

  return (
    <Screen id="drill" label="Drill">
      <div className="drill-meta">
        <span id="drill-progress">
          Play {session.index + 1} / {session.queue.length}
        </span>
        <span id="drill-score" aria-label="Running score">
          Score <strong>{runningScore(session)}</strong>
        </span>
        <span id="drill-pos">
          You · <strong>{session.position}</strong>
        </span>
      </div>
      <div className="diamond-wrap" id="diamond-wrap" ref={wrapRef} data-phase={phase}>
        <div className={`phase-banner${banner ? " " + banner.cls : ""}`} id="phase-banner">
          {banner?.text ?? ""}
        </div>
      </div>
      <p className="play-cue" id="play-cue">
        {cue}
      </p>
      <p className={`pitch-line${showPitchLine ? "" : " hidden"}`} id="pitch-line" aria-live="polite">
        {PITCH_LINE}
      </p>
      <div className="drill-ask" id="drill-ask">
        <p className={`prompt${asking ? "" : " hidden"}`} id="prompt">
          {asking ? sit.prompt : ""}
        </p>
        <div
          className={`ask-controls${veiled ? " is-veiled" : ""}`}
          id="ask-controls"
          aria-hidden={veiled}
        >
          <div className="timer-row" id="timer-row">
            <div className="timer-track">
              <div className={`timer-fill${timeCls}`} id="timer-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className={`timer-num${timeCls}`} id="timer-num" aria-live="polite">
              {Math.ceil(left)}
            </span>
          </div>
          <div className="choices" id="choices">
            {asking &&
              order.map((ch) => {
                let cls = "choice";
                if (picked) {
                  if (ch.correct) cls += " correct";
                  else if (ch.id === picked.id) cls += " wrong";
                }
                return (
                  <button
                    key={ch.id}
                    type="button"
                    className={cls}
                    data-id={ch.id}
                    disabled={phase !== "decide" || !!picked}
                    onClick={() => choose(ch.id, false)}
                  >
                    {ch.label}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </Screen>
  );
}
