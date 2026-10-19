import { useMemo, useState } from "react";
import { bank, type AgeBand, type Position, type Situation } from "@st/content";
import {
  advance,
  createSession,
  isLastPlay,
  summarize,
  type AnswerRecord,
  type TrainSession,
} from "@st/engine";
import { createDeviceStore } from "@st/data";
import { nextSeed, readConfig } from "./config.ts";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { PositionScreen } from "./screens/PositionScreen.tsx";
import { DrillScreen } from "./screens/DrillScreen.tsx";
import { FeedbackScreen } from "./screens/FeedbackScreen.tsx";
import { SummaryScreen } from "./screens/SummaryScreen.tsx";

type Screen = "home" | "position" | "drill" | "feedback" | "summary";

export interface LastAnswer {
  situation: Situation;
  answer: AnswerRecord;
}

export function App() {
  const config = useMemo(() => readConfig(), []);
  const store = useMemo(() => createDeviceStore(), []);
  const [screen, setScreen] = useState<Screen>("home");
  const [ageBand, setAgeBand] = useState<AgeBand>("8U-10U");
  const [position, setPosition] = useState<Position | null>(null);
  const [session, setSession] = useState<TrainSession | null>(null);
  const [last, setLast] = useState<LastAnswer | null>(null);

  const startSession = (pos: Position) => {
    setSession(createSession({ bank, ageBand, position: pos, seed: nextSeed(config) }));
    setScreen("drill");
  };

  const finish = (s: TrainSession) => {
    const sum = summarize(s);
    void store.saveSession({
      id: `${Date.now()}-${s.seed}`,
      finishedAt: new Date().toISOString(),
      ageBand: s.ageBand,
      position: s.position,
      plays: sum.plays,
      correct: sum.correct,
      stars: sum.stars,
      score: sum.score,
      level: sum.level,
      situationIds: s.queue.map((q) => q.id),
    });
    setScreen("summary");
  };

  return (
    <>
      {screen === "home" && (
        <HomeScreen
          ageBand={ageBand}
          onAgeBand={setAgeBand}
          onStart={() => setScreen("position")}
        />
      )}
      {screen === "position" && (
        <PositionScreen
          ageBand={ageBand}
          position={position}
          onPick={setPosition}
          onBack={() => setScreen("home")}
          onBegin={() => position && startSession(position)}
        />
      )}
      {screen === "drill" && session && (
        <DrillScreen
          key={`${session.seed}-${session.index}`}
          session={session}
          speed={config.speed}
          onAnswered={setSession}
          onDone={(s, answer) => {
            setSession(s);
            const situation = s.queue[s.index];
            if (situation) setLast({ situation, answer });
            setScreen("feedback");
          }}
        />
      )}
      {screen === "feedback" && session && last && (
        <FeedbackScreen
          last={last}
          isLast={isLastPlay(session)}
          onNext={() => {
            if (isLastPlay(session)) finish(session);
            else {
              setSession(advance(session));
              setScreen("drill");
            }
          }}
        />
      )}
      {screen === "summary" && session && (
        <SummaryScreen
          summary={summarize(session)}
          onAgain={() => startSession(session.position)}
          onChangePosition={() => setScreen("position")}
          onHome={() => setScreen("home")}
        />
      )}
    </>
  );
}
