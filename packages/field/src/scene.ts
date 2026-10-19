import { POSITIONS, type Position } from "@st/content";
import { color, font } from "@st/ui/tokens";
import { FIELD, type Point } from "./geometry.ts";

/** What the diamond shows before anything moves. */
export interface FieldScene {
  /** The player's spot (highlighted). */
  you: Position;
  /** Runner marks by starting base. */
  runners: ("home" | "1B" | "2B" | "3B")[];
}

export function runnerMarkup(start: string, index: number, p: Point): string {
  return `<g class="runner-g" data-runner="${index}" data-start="${start}" transform="translate(${p.x},${p.y})">
    <ellipse class="runner-shadow" cx="0" cy="1.8" rx="2.4" ry="1.1" fill="rgba(0,0,0,0.35)"/>
    <circle class="runner-dot" cx="0" cy="0" r="3.1" fill="${color.amber}" stroke="${color.bgDeep}" stroke-width="0.75"/>
    <text class="runner-label" x="0" y="-5.2" text-anchor="middle" fill="${color.amber}" font-size="3.1" font-family="${font.svg}" font-weight="700">R</text>
  </g>`;
}

export function runnerInnerMarkup(): string {
  return runnerMarkup("", 0, { x: 0, y: 0 }).replace(/^<g[^>]*>|<\/g>$/g, "");
}

function posSpots(you: Position): string {
  return POSITIONS.map((pos) => {
    const p = FIELD[pos];
    const isYou = pos === you;
    return `<circle class="pos-spot${isYou ? " you" : ""}" cx="${p.x}" cy="${p.y}" r="${isYou ? 4.2 : 2.4}" fill="${isYou ? color.lime : "rgba(232,239,230,0.22)"}" stroke="${isYou ? color.limeHot : "rgba(232,239,230,0.35)"}" stroke-width="${isYou ? 1.2 : 0.5}"/>
      <text x="${p.x}" y="${p.y + (isYou ? 8 : 6.5)}" text-anchor="middle" fill="${isYou ? color.limeHot : "rgba(232,239,230,0.55)"}" font-size="${isYou ? 3.6 : 2.8}" font-family="${font.svg}" font-weight="${isYou ? 800 : 600}">${pos}</text>`;
  }).join("");
}

/** Static SVG for the drill diamond (legacy schematic look, pre-mock). */
export function renderFieldSvg(scene: FieldScene): string {
  const you = FIELD[scene.you];
  const runners = scene.runners.map((b, i) => runnerMarkup(b, i, FIELD[b])).join("");
  return `<svg class="diamond-svg" viewBox="0 0 100 100" role="img" aria-label="Softball diamond with play animation">
    <defs>
      <linearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color.dirtTop}"/>
        <stop offset="100%" stop-color="${color.dirtBottom}"/>
      </linearGradient>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <polygon points="50,88 78,58 50,28 22,58" fill="url(#dirt)" opacity="0.85"/>
    <polygon points="50,88 78,58 50,28 22,58" fill="none" stroke="rgba(232,239,230,0.55)" stroke-width="1.2"/>
    <rect x="47.5" y="85.5" width="5" height="5" fill="${color.chalk}" transform="rotate(45 50 88)"/>
    <rect x="75.5" y="55.5" width="5" height="5" fill="${color.chalk}" transform="rotate(45 78 58)"/>
    <rect x="47.5" y="25.5" width="5" height="5" fill="${color.chalk}" transform="rotate(45 50 28)"/>
    <rect x="19.5" y="55.5" width="5" height="5" fill="${color.chalk}" transform="rotate(45 22 58)"/>
    <circle cx="50" cy="62" r="3.5" fill="${color.mound}" opacity="0.9"/>
    ${posSpots(scene.you)}
    <path data-trail="pitch" class="pitch-trail" d="" fill="none" stroke="rgba(232,239,230,0.28)" stroke-width="0.75" stroke-linecap="round" stroke-dasharray="1.2 1.4"/>
    <path data-trail="hit" class="ball-trail" d="" fill="none" stroke="rgba(232,239,230,0.4)" stroke-width="0.9" stroke-linecap="round" stroke-dasharray="1.6 1.2"/>
    <path data-trail="throw" class="throw-trail" d="" fill="none" stroke="rgba(184,226,58,0.55)" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 1.4"/>
    ${runners}
    <g data-ball class="ball-g" opacity="0">
      <ellipse data-ball-shadow cx="0" cy="0" rx="2.2" ry="1.1" fill="rgba(0,0,0,0.4)"/>
      <circle data-ball-dot cx="0" cy="0" r="2.2" fill="${color.chalk}" stroke="${color.lime}" stroke-width="0.85" filter="url(#softGlow)"/>
    </g>
    <circle cx="${you.x}" cy="${you.y}" r="7" fill="none" stroke="${color.lime}" stroke-width="0.7" opacity="0.55" stroke-dasharray="2 1.5"/>
  </svg>`;
}
