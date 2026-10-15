(function () {
  "use strict";

  const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  const SESSION_LEN = 5;
  const TAG_LABELS = {
    "force-play": "Force plays",
    cutoff: "Cutoffs / relays",
    priority: "Pop-up priority",
    "bunt-defense": "Bunt defense",
    "tagging-up": "Tagging up",
    backup: "Backup responsibilities",
  };

  /** Field coords in SVG viewBox 0–100 (home bottom, 2B top) */
  const FIELD = {
    home: { x: 50, y: 88 },
    "1B": { x: 78, y: 58 },
    "2B": { x: 50, y: 28 },
    "3B": { x: 22, y: 58 },
    P: { x: 50, y: 62 },
    C: { x: 50, y: 92 },
    SS: { x: 36, y: 42 },
    LF: { x: 18, y: 22 },
    CF: { x: 50, y: 12 },
    RF: { x: 82, y: 22 },
    "cutoff-home": { x: 50, y: 48 },
    "cutoff-3B": { x: 38, y: 48 },
    "mound-1B": { x: 60, y: 56 },
    "SS-LF": { x: 28, y: 34 },
    backstop: { x: 50, y: 97 },
    gap: { x: 68, y: 22 },
  };

  const BALL_LANDING = {
    "1B": { x: 72, y: 54 },
    SS: { x: 38, y: 44 },
    LF: { x: 22, y: 28 },
    RF: { x: 78, y: 30 },
    CF: { x: 50, y: 18 },
    "2B": { x: 50, y: 30 },
    "mound-1B": { x: 60, y: 56 },
    "SS-LF": { x: 28, y: 34 },
    "3B": { x: 30, y: 64 },
    home: { x: 48, y: 80 },
    backstop: { x: 50, y: 97 },
    gap: { x: 68, y: 22 },
    C: { x: 50, y: 90 },
  };

  const BASE_ORDER = ["home", "1B", "2B", "3B", "home"];

  const state = {
    ageBand: "8U-10U",
    position: null,
    queue: [],
    index: 0,
    phase: "idle", // setup | pitch-cue | playin | freeze | read | ask | feedback
    starsEarned: 0,
    correctCount: 0,
    answers: [],
    timerId: null,
    animRaf: null,
    phaseTimeouts: [],
    timerLeft: 0,
    timerTotal: 0,
    startedAt: 0,
    askLocked: false,
    freezeSnap: null, // { midFlight, ball: {x,y} }
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function showScreen(id) {
    $$(".screen").forEach((el) => {
      el.classList.remove("active");
      el.classList.remove("screen-enter");
    });
    const screen = $("#screen-" + id);
    if (screen) {
      screen.classList.add("active");
      // retrigger enter animation
      void screen.offsetWidth;
      screen.classList.add("screen-enter");
    }
  }

  function timerSecondsForAge() {
    return state.ageBand === "8U-10U" ? 8 : 6;
  }

  function starThresholds(total) {
    return {
      three: total * 0.55,
      two: total * 0.25,
    };
  }

  function starsForAnswer(correct, elapsed, timedOut) {
    if (!correct || timedOut) return 0;
    const left = Math.max(0, state.timerTotal - elapsed);
    const t = starThresholds(state.timerTotal);
    if (left >= t.three) return 3;
    if (left >= t.two) return 2;
    return 1;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildQueue() {
    const bank = window.SITUATIONS || [];
    let pool = shuffle(
      bank.filter(
        (s) =>
          s.ageBands.includes(state.ageBand) &&
          s.positions.includes(state.position)
      )
    );
    if (pool.length === 0) {
      pool = shuffle(bank.filter((s) => s.positions.includes(state.position)));
    }
    if (pool.length === 0) pool = shuffle(bank);

    const picked = [];
    const usedTags = new Set();
    const rest = [];
    for (const s of pool) {
      const novel = s.tags.some((t) => !usedTags.has(t));
      if (novel && picked.length < SESSION_LEN) {
        picked.push(s);
        s.tags.forEach((t) => usedTags.add(t));
      } else {
        rest.push(s);
      }
    }
    for (const s of rest) {
      if (picked.length >= SESSION_LEN) break;
      if (!picked.includes(s)) picked.push(s);
    }
    return picked.slice(0, Math.min(SESSION_LEN, picked.length));
  }

  function clearTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function clearPhaseTimeouts() {
    state.phaseTimeouts.forEach(clearTimeout);
    state.phaseTimeouts = [];
  }

  function clearAnim() {
    if (state.animRaf) {
      cancelAnimationFrame(state.animRaf);
      state.animRaf = null;
    }
  }

  function schedule(fn, ms) {
    const id = setTimeout(fn, ms);
    state.phaseTimeouts.push(id);
    return id;
  }

  function currentSituation() {
    return state.queue[state.index];
  }

  function outsLabel(n) {
    if (n === 0) return "nobody out";
    if (n === 1) return "1 out";
    return "2 outs";
  }

  function runnersKidLabel(runners) {
    const bases = [];
    if (runners && runners["1B"]) bases.push("1st");
    if (runners && runners["2B"]) bases.push("2nd");
    if (runners && runners["3B"]) bases.push("3rd");
    if (!bases.length) return "bases empty";
    if (bases.length === 3) return "bases loaded";
    if (bases.length === 1) return "runner on " + bases[0];
    return "runners on " + bases.join(" and ");
  }

  function countKidLabel(balls, strikes) {
    const b = balls == null ? 0 : balls;
    const s = strikes == null ? 0 : strikes;
    const ballPart = b === 1 ? "1 ball" : b + " balls";
    const strikePart =
      s === 0 ? "no strikes" : s === 1 ? "1 strike" : s + " strikes";
    return ballPart + ", " + strikePart;
  }

  /** Kid-clear pre-pitch setup, e.g. "2 balls, no strikes, nobody out, runner on 1st" */
  function situationSetupLine(sit) {
    return (
      countKidLabel(sit.balls, sit.strikes) +
      ", " +
      outsLabel(sit.outs) +
      ", " +
      runnersKidLabel(sit.runners)
    );
  }

  function freezeMode(sit) {
    return sit.freeze === "in-flight" ? "in-flight" : "after";
  }

  function pt(key) {
    return FIELD[key] || BALL_LANDING[key] || FIELD.home;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /** Quadratic bezier */
  function bez2(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  }

  function midHigh(a, b, lift) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 - lift,
    };
  }

  /** Path along diamond baselines for multi-base advances */
  function basePath(fromKey, toKey) {
    const from = fromKey === "home" ? "home" : fromKey;
    const to = toKey === "home" ? "home" : toKey;
    if (from === to) return [pt(from)];

    // Walk forward around the diamond
    const startIdx = BASE_ORDER.indexOf(from);
    let endIdx = BASE_ORDER.indexOf(to);
    if (startIdx < 0 || endIdx < 0) return [pt(from), pt(to)];
    if (to === "home" && from !== "home") endIdx = 4;

    const points = [];
    let i = startIdx;
    points.push(pt(BASE_ORDER[i]));
    let guard = 0;
    while (i !== endIdx && guard < 6) {
      i += 1;
      if (i >= BASE_ORDER.length) break;
      points.push(pt(BASE_ORDER[i]));
      guard += 1;
    }
    // 1B → 3B via 2B
    if (from === "1B" && to === "3B") {
      return [pt("1B"), pt("2B"), pt("3B")];
    }
    if (from === "2B" && to === "home") {
      return [pt("2B"), pt("3B"), pt("home")];
    }
    if (points.length >= 2) return points;
    return [pt(from), pt(to)];
  }

  function samplePolyline(points, t) {
    if (points.length === 1) return points[0];
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.hypot(dx, dy) || 0.001;
      segs.push({ a: points[i], b: points[i + 1], len });
      total += len;
    }
    let dist = Math.max(0, Math.min(1, t)) * total;
    for (const s of segs) {
      if (dist <= s.len) {
        const u = dist / s.len;
        return { x: lerp(s.a.x, s.b.x, u), y: lerp(s.a.y, s.b.y, u) };
      }
      dist -= s.len;
    }
    return points[points.length - 1];
  }

  /** Motion profile from ball.type → height curve + duration */
  function ballProfile(type) {
    switch (type) {
      case "grounder":
        return { duration: 720, peakH: 0.12, style: "ground", trail: "dirt" };
      case "bunt":
        return { duration: 650, peakH: 0.08, style: "ground", trail: "dirt" };
      case "wild-pitch":
        return { duration: 700, peakH: 0.1, style: "ground", trail: "dirt" };
      case "single":
        return { duration: 900, peakH: 0.35, style: "line", trail: "air" };
      case "gap":
        return { duration: 1100, peakH: 0.45, style: "line", trail: "air" };
      case "line":
        return { duration: 800, peakH: 0.3, style: "line", trail: "air" };
      case "popup":
        return { duration: 1300, peakH: 1, style: "arc", trail: "air" };
      case "fly":
        return { duration: 1400, peakH: 0.95, style: "arc", trail: "air" };
      case "steal":
        return { duration: 850, peakH: 0.4, style: "throw", trail: "throw" };
      default:
        return { duration: 900, peakH: 0.35, style: "line", trail: "air" };
    }
  }

  function throwProfile() {
    return { duration: 700, peakH: 0.42, style: "throw", trail: "throw" };
  }

  function pitchProfile() {
    return { duration: 480, peakH: 0.22, style: "pitch", trail: "pitch" };
  }

  function heightAt(t, peakH, style) {
    // 0..1 along leg → apparent height 0..peak..0
    if (style === "ground") {
      const bounce = Math.abs(Math.sin(t * Math.PI * 2.2)) * peakH * 0.7;
      return peakH * 0.35 + bounce * (1 - t * 0.5);
    }
    if (style === "pitch") {
      return peakH * Math.sin(Math.PI * t) * 0.85;
    }
    const arch = Math.sin(Math.PI * t);
    return peakH * arch;
  }

  /**
   * Legs: optional pitch (P→plate) → hit/batted ball → optional throw.
   * Set ball.pitch === false to skip (default: pitch on).
   */
  function buildBallLegs(sit) {
    const type = sit.ball.type;
    const plate = { x: 50, y: 86 };
    const endKey = sit.ball.region;
    const end = BALL_LANDING[endKey] || pt(endKey);
    const legs = [];

    const includePitch = sit.ball.pitch !== false;
    if (includePitch) {
      legs.push({
        start: pt("P"),
        end: plate,
        profile: pitchProfile(),
        kind: "pitch",
      });
    }

    if (type === "steal") {
      legs.push({
        start: pt(sit.ball.from || "C"),
        end: end,
        profile: ballProfile("steal"),
        kind: "throw",
      });
    } else if (type === "wild-pitch") {
      legs.push({
        start: includePitch ? plate : pt("home"),
        end: BALL_LANDING.backstop,
        profile: ballProfile("wild-pitch"),
        kind: "hit",
      });
    } else {
      const hitStart = includePitch
        ? plate
        : pt(sit.ball.from || "home");
      legs.push({
        start: hitStart,
        end: end,
        profile: ballProfile(type),
        kind: "hit",
      });
      if (sit.ball.throwTo) {
        legs.push({
          start: end,
          end: pt(sit.ball.throwTo),
          profile: throwProfile(),
          kind: "throw",
        });
      }
    }
    return legs;
  }

  function resolveRunners(sit) {
    const starts = [];
    const occupied = sit.runners || {};
    ["1B", "2B", "3B"].forEach((b) => {
      if (occupied[b]) starts.push({ id: b, start: b, end: b });
    });
    const motions = sit.runnerMotion || [];
    motions.forEach((m, i) => {
      if (m.from === "home") {
        starts.push({
          id: "BR" + i,
          start: "home",
          end: m.to,
          timing: m.timing || "with-ball",
        });
        return;
      }
      const existing = starts.find((r) => r.start === m.from || r.id === m.from);
      if (existing) {
        existing.end = m.to;
        existing.timing = m.timing || "with-ball";
      } else {
        starts.push({
          id: m.from + i,
          start: m.from,
          end: m.to,
          timing: m.timing || "with-ball",
        });
      }
    });
    return starts;
  }

  /* ——— Diamond markup ——— */
  function renderDiamondShell(sit, position) {
    const you = FIELD[position] || FIELD.SS;
    const runners = resolveRunners(sit);

    const runnerEls = runners
      .map((r, i) => {
        const p = pt(r.start);
        return `<g class="runner-g" data-runner="${i}" data-start="${r.start}" transform="translate(${p.x},${p.y})">
          <ellipse class="runner-shadow" cx="0" cy="1.8" rx="2.4" ry="1.1" fill="rgba(0,0,0,0.35)"/>
          <circle class="runner-dot" cx="0" cy="0" r="3.1" fill="#f0a020" stroke="#071a14" stroke-width="0.75"/>
          <text class="runner-label" x="0" y="-5.2" text-anchor="middle" fill="#f0a020" font-size="3.1" font-family="Manrope,sans-serif" font-weight="700">R</text>
        </g>`;
      })
      .join("");

    const posSpots = POSITIONS.map((pos) => {
      const p = FIELD[pos];
      const isYou = pos === position;
      return `<circle class="pos-spot${isYou ? " you" : ""}" cx="${p.x}" cy="${p.y}" r="${isYou ? 4.2 : 2.4}" fill="${isYou ? "#b8e23a" : "rgba(232,239,230,0.22)"}" stroke="${isYou ? "#d4ff5a" : "rgba(232,239,230,0.35)"}" stroke-width="${isYou ? 1.2 : 0.5}"/>
        <text x="${p.x}" y="${p.y + (isYou ? 8 : 6.5)}" text-anchor="middle" fill="${isYou ? "#d4ff5a" : "rgba(232,239,230,0.55)"}" font-size="${isYou ? 3.6 : 2.8}" font-family="Manrope,sans-serif" font-weight="${isYou ? 800 : 600}">${pos}</text>`;
    }).join("");

    return `
      <svg class="diamond-svg" viewBox="0 0 100 100" role="img" aria-label="Softball diamond with play animation">
        <defs>
          <linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c4a574"/>
            <stop offset="100%" stop-color="#9a7a4f"/>
          </linearGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.6" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <polygon points="50,88 78,58 50,28 22,58" fill="url(#dirt)" opacity="0.85"/>
        <polygon points="50,88 78,58 50,28 22,58" fill="none" stroke="rgba(232,239,230,0.55)" stroke-width="1.2"/>
        <rect x="47.5" y="85.5" width="5" height="5" fill="#e8efe6" transform="rotate(45 50 88)"/>
        <rect x="75.5" y="55.5" width="5" height="5" fill="#e8efe6" transform="rotate(45 78 58)"/>
        <rect x="47.5" y="25.5" width="5" height="5" fill="#e8efe6" transform="rotate(45 50 28)"/>
        <rect x="19.5" y="55.5" width="5" height="5" fill="#e8efe6" transform="rotate(45 22 58)"/>
        <circle cx="50" cy="62" r="3.5" fill="#b8956a" opacity="0.9"/>
        ${posSpots}
        <path id="pitch-trail" class="pitch-trail" d="" fill="none" stroke="rgba(232,239,230,0.28)" stroke-width="0.75" stroke-linecap="round" stroke-dasharray="1.2 1.4"/>
        <path id="ball-trail" class="ball-trail" d="" fill="none" stroke="rgba(232,239,230,0.4)" stroke-width="0.9" stroke-linecap="round" stroke-dasharray="1.6 1.2"/>
        <path id="throw-trail" class="throw-trail" d="" fill="none" stroke="rgba(184,226,58,0.55)" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 1.4"/>
        ${runnerEls}
        <g id="ball-g" class="ball-g" opacity="0">
          <ellipse id="ball-shadow" cx="0" cy="0" rx="2.2" ry="1.1" fill="rgba(0,0,0,0.4)"/>
          <circle id="ball-dot" cx="0" cy="0" r="2.2" fill="#e8efe6" stroke="#b8e23a" stroke-width="0.85" filter="url(#softGlow)"/>
        </g>
        <circle cx="${you.x}" cy="${you.y}" r="7" fill="none" stroke="#b8e23a" stroke-width="0.7" opacity="0.55" stroke-dasharray="2 1.5"/>
      </svg>
    `;
  }

  function setPhaseBanner(phase) {
    const el = $("#phase-banner");
    if (!el) return;
    el.className = "phase-banner";
    if (phase === "setup") {
      el.textContent = "Set";
      el.classList.add("ask");
    } else if (phase === "pitch-cue") {
      el.textContent = "Pitch";
      el.classList.add("live");
    } else if (phase === "playin") {
      el.textContent = "Play";
      el.classList.add("live");
    } else if (phase === "freeze") {
      el.textContent = "Freeze";
      el.classList.add("freeze");
    } else if (phase === "read") {
      el.textContent = "Read";
      el.classList.add("read");
    } else if (phase === "ask") {
      el.textContent = "Decide";
      el.classList.add("ask");
    } else if (phase === "finish") {
      el.textContent = "Finish";
      el.classList.add("live");
    } else {
      el.textContent = "";
    }
  }

  /** Read beat before choices — long enough for 8U–14U to finish the prompt */
  function questionReadMs() {
    return state.ageBand === "8U-10U" ? 5000 : 4200;
  }

  function setAskControlsVeiled(on) {
    const el = $("#ask-controls");
    if (!el) return;
    el.classList.toggle("is-veiled", on);
    el.setAttribute("aria-hidden", on ? "true" : "false");
  }

  function buildChoiceButtons(sit) {
    const choicesEl = $("#choices");
    choicesEl.innerHTML = "";
    sit.choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.type = "button";
      btn.textContent = c.label;
      btn.dataset.id = c.id;
      btn.disabled = true;
      btn.addEventListener("click", () => onChoose(c.id, false));
      choicesEl.appendChild(btn);
    });
  }

  function updateTimerUI(left, total) {
    const pct = Math.max(0, (left / total) * 100);
    const fill = $("#timer-fill");
    const num = $("#timer-num");
    if (fill) {
      fill.style.width = pct + "%";
      fill.classList.toggle("urgent", left <= total * 0.4 && left > total * 0.2);
      fill.classList.toggle("critical", left <= total * 0.2);
    }
    if (num) {
      num.textContent = String(Math.ceil(left));
      num.classList.toggle("urgent", left <= total * 0.4 && left > total * 0.2);
      num.classList.toggle("critical", left <= total * 0.2);
    }
  }

  function setBallVisual(groundX, groundY, height, visible) {
    const g = $("#ball-g");
    const shadow = $("#ball-shadow");
    const dot = $("#ball-dot");
    if (!g || !shadow || !dot) return;
    g.setAttribute("opacity", visible ? "1" : "0");
    // Height lifts the ball up-screen and grows it; shadow stays on "ground"
    const lift = height * 10;
    const scale = 1 + height * 0.85;
    const shadowSpread = 1 + height * 1.4;
    shadow.setAttribute("cx", String(groundX));
    shadow.setAttribute("cy", String(groundY + 0.6));
    shadow.setAttribute("rx", String(2.2 * shadowSpread));
    shadow.setAttribute("ry", String(1.05 * (0.85 + height * 0.4)));
    shadow.setAttribute("opacity", String(0.45 - height * 0.25));
    dot.setAttribute("cx", String(groundX));
    dot.setAttribute("cy", String(groundY - lift));
    dot.setAttribute("r", String(2.15 * scale));
  }

  function appendTrail(pathEl, x, y, reset) {
    if (!pathEl) return;
    if (reset || !pathEl.getAttribute("d")) {
      pathEl.setAttribute("d", "M " + x.toFixed(2) + " " + y.toFixed(2));
    } else {
      pathEl.setAttribute(
        "d",
        pathEl.getAttribute("d") + " L " + x.toFixed(2) + " " + y.toFixed(2)
      );
    }
  }

  function runnerProgress(timing, actionT, catchT, totalT, now, actionStart) {
    // actionT = 0..1 through the batted-ball / steal throw (after pitch)
    if (timing === "after-catch") {
      if (now < catchT) return 0;
      return easeOutCubic(
        Math.min(1, (now - catchT) / Math.max(280, totalT - catchT))
      );
    }
    if (timing === "delayed") {
      const start = catchT + 180;
      if (now < start) return 0;
      return easeInOut(Math.min(1, (now - start) / 700));
    }
    if (now < actionStart) return 0;
    return easeInOut(Math.min(1, Math.max(0, actionT * 1.05 - 0.05)));
  }

  function legLift(leg) {
    if (leg.profile.style === "ground") return 2;
    if (leg.kind === "pitch") return leg.profile.peakH * 8;
    return leg.profile.peakH * 14;
  }

  function playSituationAnimation(sit, onDone) {
    clearAnim();
    const legs = buildBallLegs(sit);
    const runners = resolveRunners(sit);
    const runnerPaths = runners.map((r) => ({
      ...r,
      points: basePath(r.start, r.end),
      timing: r.timing || (r.start === r.end ? "hold" : "with-ball"),
    }));

    const starts = [];
    let acc = 0;
    legs.forEach((leg) => {
      starts.push(acc);
      acc += leg.profile.duration;
    });
    const totalDur = acc;

    const actionIdx = legs.findIndex((l) => l.kind !== "pitch");
    const actionStart = actionIdx >= 0 ? starts[actionIdx] : 0;
    const actionDur =
      actionIdx >= 0 ? legs[actionIdx].profile.duration : totalDur;
    // Catch / field moment = end of first non-pitch leg (hit or steal throw)
    const catchT = actionStart + actionDur;

    // Optional mid-play freeze along the action leg (after the pitch)
    let freezeAtMs = null;
    if (freezeMode(sit) === "in-flight" && actionIdx >= 0) {
      const at =
        typeof sit.freezeAt === "number"
          ? Math.min(0.85, Math.max(0.35, sit.freezeAt))
          : 0.55;
      freezeAtMs = actionStart + actionDur * at;
    }

    const trailPitch = $("#pitch-trail");
    const trailHit = $("#ball-trail");
    const trailThrow = $("#throw-trail");
    if (trailPitch) trailPitch.setAttribute("d", "");
    if (trailHit) trailHit.setAttribute("d", "");
    if (trailThrow) trailThrow.setAttribute("d", "");

    const t0 = performance.now();
    let lastTrail = 0;

    function trailFor(kind) {
      if (kind === "pitch") return trailPitch;
      if (kind === "throw") return trailThrow;
      return trailHit;
    }

    function sampleLeg(leg, localT) {
      const t =
        leg.kind === "throw" || leg.kind === "pitch"
          ? easeOutCubic(localT)
          : easeInOut(localT);
      const ctrl = midHigh(leg.start, leg.end, legLift(leg));
      const ground = bez2(leg.start, ctrl, leg.end, t);
      const height = heightAt(t, leg.profile.peakH, leg.profile.style);
      return { ground, height };
    }

    function frame(now) {
      const elapsed = now - t0;
      const u = Math.min(1, elapsed / totalDur);

      let legIndex = legs.length - 1;
      for (let i = 0; i < legs.length; i++) {
        const end = starts[i] + legs[i].profile.duration;
        if (elapsed <= end) {
          legIndex = i;
          break;
        }
      }
      const leg = legs[legIndex];
      const localT = Math.min(
        1,
        Math.max(0, (elapsed - starts[legIndex]) / leg.profile.duration)
      );
      const { ground, height } = sampleLeg(leg, localT);
      setBallVisual(ground.x, ground.y, height, true);

      if (elapsed - lastTrail > 28) {
        const trail = trailFor(leg.kind);
        appendTrail(trail, ground.x, ground.y - height * 10, false);
        lastTrail = elapsed;
      }

      const actionT =
        elapsed <= actionStart
          ? 0
          : Math.min(1, (elapsed - actionStart) / actionDur);

      runnerPaths.forEach((r, i) => {
        const g = document.querySelector('[data-runner="' + i + '"]');
        if (!g) return;
        if (r.timing === "hold" || (r.start === r.end && !sit.runnerMotion)) {
          const p = r.points[0];
          g.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");
          return;
        }
        const rp = runnerProgress(
          r.timing,
          actionT,
          catchT,
          totalDur,
          elapsed,
          actionStart
        );
        const p = samplePolyline(r.points, rp);
        g.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");
      });

      // Mid-play freeze — leave ball/runners where they are, then question
      if (freezeAtMs != null && elapsed >= freezeAtMs) {
        state.animRaf = null;
        onDone({ midFlight: true, ball: { x: ground.x, y: ground.y } });
        return;
      }

      if (u < 1) {
        state.animRaf = requestAnimationFrame(frame);
      } else {
        state.animRaf = null;
        const endLeg = legs[legs.length - 1];
        setBallVisual(endLeg.end.x, endLeg.end.y, 0, true);
        runnerPaths.forEach((r, i) => {
          const g = document.querySelector('[data-runner="' + i + '"]');
          if (!g) return;
          const p = r.points[r.points.length - 1];
          g.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");
        });
        onDone({
          midFlight: false,
          ball: { x: endLeg.end.x, y: endLeg.end.y },
        });
      }
    }

    // Start on the rubber before the pitch
    if (legs[0] && legs[0].kind === "pitch") {
      setBallVisual(legs[0].start.x, legs[0].start.y, 0, true);
    }
    state.animRaf = requestAnimationFrame(frame);
  }

  /** After freeze: show question alone; controls stay veiled (opacity) with same footprint */
  function startQuestionReadPhase(sit) {
    state.phase = "read";
    state.askLocked = true;

    const prompt = $("#prompt");
    prompt.textContent = sit.prompt;
    prompt.classList.remove("hidden");
    // No typography class toggles — font-size/line-height stay locked in CSS
    $("#play-cue").classList.remove("hidden");

    buildChoiceButtons(sit);
    state.timerTotal = timerSecondsForAge();
    state.timerLeft = state.timerTotal;
    updateTimerUI(state.timerLeft, state.timerTotal);
    setAskControlsVeiled(true);
    setPhaseBanner("read");

    schedule(() => {
      if (state.phase !== "read") return;
      revealChoicesAndStartTimer(sit);
    }, questionReadMs());
  }

  function revealChoicesAndStartTimer(sit) {
    state.phase = "ask";
    state.askLocked = false;
    setPhaseBanner("ask");

    // Keep prompt classes identical to Read — only unveil controls
    $("#prompt").classList.remove("hidden");
    setAskControlsVeiled(false);
    $$("#choices .choice").forEach((btn) => {
      btn.disabled = false;
    });

    state.timerTotal = timerSecondsForAge();
    state.timerLeft = state.timerTotal;
    state.startedAt = performance.now();
    updateTimerUI(state.timerLeft, state.timerTotal);

    clearTimer();
    state.timerId = setInterval(() => {
      if (state.phase !== "ask" || state.askLocked) return;
      const elapsed = (performance.now() - state.startedAt) / 1000;
      state.timerLeft = Math.max(0, state.timerTotal - elapsed);
      updateTimerUI(state.timerLeft, state.timerTotal);
      if (state.timerLeft <= 0) {
        clearTimer();
        onChoose(null, true);
      }
    }, 50);
  }

  function beginSituation() {
    clearTimer();
    clearAnim();
    clearPhaseTimeouts();
    state.askLocked = false;

    const sit = currentSituation();
    if (!sit) {
      showSummary();
      return;
    }

    state.phase = "setup";
    showScreen("drill");

    $("#drill-progress").textContent =
      "Play " + (state.index + 1) + " / " + state.queue.length;
    $("#drill-pos").innerHTML = "You · <strong>" + state.position + "</strong>";

    // 1) Situation first — count / outs / runners, runners on diamond, no ball motion
    $("#play-cue").textContent = situationSetupLine(sit);
    $("#play-cue").classList.remove("hidden");
    const pitchLine = $("#pitch-line");
    if (pitchLine) {
      pitchLine.classList.add("hidden");
      pitchLine.textContent = "Here's the pitch…";
    }

    $("#prompt").classList.add("hidden");
    $("#prompt").textContent = "";
    $("#choices").innerHTML = "";
    setAskControlsVeiled(true);

    const wrap = $("#diamond-wrap");
    wrap.innerHTML =
      '<div class="phase-banner" id="phase-banner"></div>' +
      renderDiamondShell(sit, state.position);
    setPhaseBanner("setup");
    // Hide ball until pitch starts
    setBallVisual(FIELD.P.x, FIELD.P.y, 0, false);

    schedule(() => {
      if (state.phase !== "setup") return;
      // 2) Pitch cue line
      state.phase = "pitch-cue";
      setPhaseBanner("pitch-cue");
      if (pitchLine) pitchLine.classList.remove("hidden");

      schedule(() => {
        if (state.phase !== "pitch-cue") return;
        // 3) Pitch + play animation
        state.phase = "playin";
        setPhaseBanner("playin");
        playSituationAnimation(sit, (result) => {
          if (state.phase !== "playin") return;
          // 4) Freeze (mid-flight or after play) → question
          state.freezeSnap = {
            midFlight: !!(result && result.midFlight),
            ball: result && result.ball
              ? result.ball
              : { x: FIELD.P.x, y: FIELD.P.y },
          };
          state.phase = "freeze";
          setPhaseBanner("freeze");
          if (pitchLine) pitchLine.classList.add("hidden");
          schedule(() => {
            if (state.phase !== "freeze") return;
            startQuestionReadPhase(sit);
          }, result && result.midFlight ? 400 : 550);
        });
      }, 900);
    }, 2200);
  }

  function buildOutcomeLegs(sit, correct, snap) {
    const outcome = correct ? sit.outcomeCorrect : sit.outcomeWrong;
    if (!outcome) return { legs: [], runners: [], caption: "" };

    const legs = [];
    let start = {
      x: (snap && snap.ball && snap.ball.x) || FIELD.P.x,
      y: (snap && snap.ball && snap.ball.y) || FIELD.P.y,
    };
    const mid = snap && snap.midFlight;
    const complete =
      outcome.completeToLanding !== false &&
      mid &&
      sit.ball &&
      sit.ball.region;

    if (complete) {
      const landing = BALL_LANDING[sit.ball.region] || pt(sit.ball.region);
      const remProf = Object.assign({}, ballProfile(sit.ball.type), {
        duration: Math.max(320, ballProfile(sit.ball.type).duration * 0.45),
      });
      legs.push({
        start: start,
        end: landing,
        profile: remProf,
        kind: sit.ball.type === "steal" ? "throw" : "hit",
      });
      start = landing;
    }

    // Soft "drop" on a missed popup/fly — settle on the dirt
    if (outcome.drop) {
      const dirt = { x: start.x + 2, y: start.y + 4 };
      legs.push({
        start: start,
        end: dirt,
        profile: { duration: 380, peakH: 0.08, style: "ground", trail: "dirt" },
        kind: "hit",
      });
      start = dirt;
    }

    const path = outcome.ballPath || [];
    path.forEach((step) => {
      const end = pt(step.to);
      const kind = step.kind || "throw";
      const profile =
        kind === "throw"
          ? throwProfile()
          : Object.assign({}, ballProfile(kind), {
              duration: step.duration || ballProfile(kind).duration,
            });
      legs.push({ start: start, end: end, profile: profile, kind: kind });
      start = end;
    });

    return {
      legs: legs,
      runners: outcome.runners || [],
      caption:
        outcome.caption ||
        (correct ? "Nice call — finish the play!" : "Here's what happened…"),
    };
  }

  function applyRunnerEndState(g, endState) {
    if (!g) return;
    const label = g.querySelector(".runner-label");
    const dot = g.querySelector(".runner-dot");
    g.classList.remove("runner-out", "runner-safe", "runner-score");
    if (endState === "out") {
      g.classList.add("runner-out");
      if (label) label.textContent = "X";
      if (dot) dot.setAttribute("fill", "#e85d4c");
    } else if (endState === "score") {
      g.classList.add("runner-score");
      if (label) label.textContent = "!";
      if (dot) dot.setAttribute("fill", "#5ecf8a");
    } else if (endState === "safe") {
      g.classList.add("runner-safe");
      if (label) label.textContent = "S";
    }
  }

  function playOutcomeAnimation(sit, correct, onDone) {
    clearAnim();
    const snap = state.freezeSnap || { midFlight: false, ball: { x: 50, y: 62 } };
    const built = buildOutcomeLegs(sit, correct, snap);
    const cue = $("#play-cue");
    if (cue) {
      cue.textContent = built.caption;
      cue.classList.remove("hidden");
    }
    const pitchLine = $("#pitch-line");
    if (pitchLine) pitchLine.classList.add("hidden");
    setAskControlsVeiled(true);
    setPhaseBanner("finish");

    // Ensure outcome runners exist on diamond (match by start base)
    const runnerEls = $$(".runner-g");
    const outcomeRunners = built.runners.map((r, i) => {
      let g =
        runnerEls.find((el) => {
          // prefer data-start if present
          return el.getAttribute("data-start") === r.from;
        }) || runnerEls[i];
      if (!g && r.from) {
        // create a runner mark for batter-runner finishes
        const svg = document.querySelector(".diamond-svg");
        if (svg) {
          const p0 = pt(r.from);
          const ns = "http://www.w3.org/2000/svg";
          g = document.createElementNS(ns, "g");
          g.classList.add("runner-g");
          g.setAttribute("data-start", r.from);
          g.setAttribute("data-runner", String(100 + i));
          g.setAttribute("transform", "translate(" + p0.x + "," + p0.y + ")");
          g.innerHTML =
            '<ellipse class="runner-shadow" cx="0" cy="1.8" rx="2.4" ry="1.1" fill="rgba(0,0,0,0.35)"/>' +
            '<circle class="runner-dot" cx="0" cy="0" r="3.1" fill="#f0a020" stroke="#071a14" stroke-width="0.75"/>' +
            '<text class="runner-label" x="0" y="-5.2" text-anchor="middle" fill="#f0a020" font-size="3.1" font-family="Manrope,sans-serif" font-weight="700">R</text>';
          svg.appendChild(g);
        }
      }
      if (g) {
        g.setAttribute("data-start", r.from);
        const p0 = pt(r.from);
        g.setAttribute("transform", "translate(" + p0.x + "," + p0.y + ")");
        const label = g.querySelector(".runner-label");
        if (label) label.textContent = "R";
        const dot = g.querySelector(".runner-dot");
        if (dot) dot.setAttribute("fill", "#f0a020");
        g.classList.remove("runner-out", "runner-safe", "runner-score");
      }
      return {
        g: g,
        points: basePath(r.from, r.to || r.from),
        endState: r.endState || "safe",
        hold: !r.to || r.to === r.from,
      };
    });

    const legs = built.legs;
    if (!legs.length) {
      // Instant resolve (e.g. catch held)
      outcomeRunners.forEach((r) => {
        if (r.g) applyRunnerEndState(r.g, r.endState);
      });
      schedule(onDone, 500);
      return;
    }

    const starts = [];
    let acc = 0;
    legs.forEach((leg) => {
      starts.push(acc);
      acc += leg.profile.duration;
    });
    const totalDur = acc;
    const trailHit = $("#ball-trail");
    const trailThrow = $("#throw-trail");
    // keep existing trails; append outcome path
    const t0 = performance.now();
    let lastTrail = 0;

    function trailFor(kind) {
      return kind === "throw" ? trailThrow : trailHit;
    }

    function sampleLeg(leg, localT) {
      const t =
        leg.kind === "throw" ? easeOutCubic(localT) : easeInOut(localT);
      const ctrl = midHigh(leg.start, leg.end, legLift(leg));
      const ground = bez2(leg.start, ctrl, leg.end, t);
      const height = heightAt(t, leg.profile.peakH, leg.profile.style);
      return { ground, height };
    }

    function frame(now) {
      const elapsed = now - t0;
      const u = Math.min(1, elapsed / totalDur);
      let legIndex = legs.length - 1;
      for (let i = 0; i < legs.length; i++) {
        if (elapsed <= starts[i] + legs[i].profile.duration) {
          legIndex = i;
          break;
        }
      }
      const leg = legs[legIndex];
      const localT = Math.min(
        1,
        Math.max(0, (elapsed - starts[legIndex]) / leg.profile.duration)
      );
      const { ground, height } = sampleLeg(leg, localT);
      setBallVisual(ground.x, ground.y, height, true);
      if (elapsed - lastTrail > 28) {
        appendTrail(trailFor(leg.kind), ground.x, ground.y - height * 10, false);
        lastTrail = elapsed;
      }

      const rp = easeInOut(u);
      outcomeRunners.forEach((r) => {
        if (!r.g) return;
        if (r.hold) {
          const p = r.points[0];
          r.g.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");
          return;
        }
        const p = samplePolyline(r.points, rp);
        r.g.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");
      });

      if (u < 1) {
        state.animRaf = requestAnimationFrame(frame);
      } else {
        state.animRaf = null;
        const endLeg = legs[legs.length - 1];
        setBallVisual(endLeg.end.x, endLeg.end.y, 0, true);
        outcomeRunners.forEach((r) => {
          if (!r.g) return;
          const p = r.points[r.points.length - 1];
          r.g.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");
          applyRunnerEndState(r.g, r.endState);
        });
        schedule(onDone, 420);
      }
    }

    setBallVisual(snap.ball.x, snap.ball.y, 0, true);
    state.animRaf = requestAnimationFrame(frame);
  }

  function onChoose(choiceId, timedOut) {
    if (state.phase !== "ask" || state.askLocked) return;
    state.askLocked = true;
    clearTimer();

    const sit = currentSituation();
    const elapsed = (performance.now() - state.startedAt) / 1000;
    const correct =
      !timedOut &&
      choiceId != null &&
      sit.correctChoiceIds.includes(choiceId);
    const stars = starsForAnswer(correct, elapsed, !!timedOut);

    state.starsEarned += stars;
    if (correct) state.correctCount += 1;
    state.answers.push({
      id: sit.id,
      tags: sit.tags,
      correct,
      stars,
      timedOut: !!timedOut,
      choiceId,
    });

    // Highlight choice, stay on diamond for finish animation
    $$("#choices .choice").forEach((btn) => {
      btn.disabled = true;
      const id = btn.dataset.id;
      if (sit.correctChoiceIds.includes(id)) btn.classList.add("correct");
      else if (id === choiceId) btn.classList.add("wrong");
    });

    state.phase = "finish";
    schedule(() => {
      playOutcomeAnimation(sit, correct, () => {
        showFeedback(sit, stars, correct, timedOut);
      });
    }, timedOut ? 180 : 280);
  }

  function showFeedback(sit, stars, correct, timedOut) {
    const title = $("#feedback-title");
    if (timedOut) {
      title.textContent = "Time!";
      title.className = "feedback-title miss";
    } else if (correct) {
      title.textContent = stars === 3 ? "Quick!" : stars === 2 ? "Solid" : "Got it";
      title.className = "feedback-title hit";
    } else {
      title.textContent = "Miss";
      title.className = "feedback-title miss";
    }

    $$("#stars .star").forEach((el, i) => {
      el.classList.remove("on");
      el.classList.remove("star-pop");
    });
    $("#explanation").textContent = sit.explanation;
    const nextBtn = $("#btn-next");
    const isLast = state.index >= state.queue.length - 1;
    nextBtn.textContent = isLast ? "See session summary" : "Next situation";
    showScreen("feedback");

    // Stagger star pops after screen is up (prompt/layout untouched)
    requestAnimationFrame(() => {
      $$("#stars .star").forEach((el, i) => {
        if (i < stars) {
          schedule(() => {
            el.classList.add("on");
            el.classList.add("star-pop");
          }, 80 + i * 90);
        }
      });
      $("#explanation").classList.remove("explain-in");
      void $("#explanation").offsetWidth;
      $("#explanation").classList.add("explain-in");
    });
  }

  function showSummary() {
    showScreen("summary");
    const total = state.queue.length;
    const accuracy = total ? Math.round((state.correctCount / total) * 100) : 0;
    $("#sum-stars").textContent = String(state.starsEarned);
    $("#sum-accuracy").textContent = accuracy + "%";
    $("#sum-correct").textContent = state.correctCount + " / " + total;

    const missTags = {};
    state.answers.forEach((a) => {
      if (!a.correct) {
        a.tags.forEach((t) => {
          missTags[t] = (missTags[t] || 0) + 1;
        });
      }
    });
    const patterns = Object.entries(missTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => TAG_LABELS[tag] || tag);

    const list = $("#patterns");
    list.innerHTML = "";
    if (patterns.length === 0) {
      const li = document.createElement("li");
      li.innerHTML =
        "<strong>Clean session.</strong> Keep mixing positions next time to stretch new reads.";
      list.appendChild(li);
    } else {
      patterns.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = "Review: <strong>" + p + "</strong>";
        list.appendChild(li);
      });
    }
  }

  function initHome() {
    $$("#age-seg button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.ageBand = btn.dataset.age;
        $$("#age-seg button").forEach((b) =>
          b.classList.toggle("selected", b === btn)
        );
      });
    });
    $("#btn-start").addEventListener("click", () => {
      showScreen("position");
      renderPositionGrid();
    });
  }

  function renderPositionGrid() {
    const field = $("#pos-field");
    if (!field) return;
    // Diamond order for a11y / DOM: OF → middle → corners → battery
    const order = ["LF", "CF", "RF", "SS", "2B", "3B", "1B", "P", "C"];
    field.innerHTML = "";
    order.forEach((pos) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = pos;
      btn.dataset.pos = pos;
      btn.setAttribute("aria-label", "Position " + pos);
      btn.setAttribute("aria-pressed", state.position === pos ? "true" : "false");
      btn.classList.toggle("selected", state.position === pos);
      btn.addEventListener("click", () => {
        state.position = pos;
        renderPositionGrid();
        const begin = $("#btn-begin");
        if (begin) begin.disabled = false;
      });
      field.appendChild(btn);
    });
    const age = $("#pos-age");
    if (age) age.textContent = state.ageBand;
  }

  function initPosition() {
    $("#btn-back-home").addEventListener("click", () => showScreen("home"));
    $("#btn-begin").addEventListener("click", () => {
      if (!state.position) return;
      state.queue = buildQueue();
      state.index = 0;
      state.starsEarned = 0;
      state.correctCount = 0;
      state.answers = [];
      beginSituation();
    });
  }

  function initFeedback() {
    $("#btn-next").addEventListener("click", () => {
      if (state.index >= state.queue.length - 1) {
        showSummary();
      } else {
        state.index += 1;
        beginSituation();
      }
    });
  }

  function initSummary() {
    $("#btn-again").addEventListener("click", () => {
      state.queue = buildQueue();
      state.index = 0;
      state.starsEarned = 0;
      state.correctCount = 0;
      state.answers = [];
      beginSituation();
    });
    $("#btn-change-pos").addEventListener("click", () => {
      showScreen("position");
      renderPositionGrid();
    });
    $("#btn-home").addEventListener("click", () => showScreen("home"));
  }

  function init() {
    initHome();
    initPosition();
    initFeedback();
    initSummary();
    showScreen("home");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
