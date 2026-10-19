import { POSITION_NAMES, POSITIONS, type Position } from "./constants.ts";
import { SituationSchema, type Situation } from "./schema.ts";

export interface ValidationIssue {
  id: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  situations: Situation[];
}

/** Labels that only make sense in a fixed order break when choices are shuffled. */
const ORDER_DEPENDENT =
  /\b(all|none|both) of (the )?(above|below|these)\b|\b(above|below)\b|^\s*[a-d][).:]\s|\boption [a-d]\b/i;

/**
 * Names the prompt might use to address a player directly ("Right field — what do you do?",
 * "As the catcher, ..."). Used to catch prompts written for a different POV than `position`.
 */
function addresseeNames(pos: Position): string[] {
  const base = POSITION_NAMES[pos].toLowerCase();
  const extra: Partial<Record<Position, string[]>> = {
    P: ["pitcher"],
    C: ["catcher"],
    "1B": ["first baseman", "first base"],
    "2B": ["second baseman", "second base"],
    "3B": ["third baseman", "third base"],
    SS: ["shortstop"],
  };
  return [base, ...(extra[pos] ?? [])];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function promptAddressees(prompt: string): Position[] {
  const found = new Set<Position>();
  for (const pos of POSITIONS) {
    for (const name of addresseeNames(pos)) {
      const n = escapeRe(name);
      const direct = new RegExp(`(^|[.!?]\\s+)${n}\\s*[—–-]`, "i");
      const asRole = new RegExp(`\\bas (the )?${n}\\b`, "i");
      const youAre = new RegExp(`\\byou(?:'re| are) (the |at )?${n}\\b`, "i");
      if (direct.test(prompt) || asRole.test(prompt) || youAre.test(prompt)) found.add(pos);
    }
  }
  return [...found];
}

function checkSituation(s: Situation): string[] {
  const errs: string[] = [];

  const correct = s.choices.filter((c) => c.correct);
  if (correct.length === 0) errs.push("needs at least one correct choice");

  const ids = s.choices.map((c) => c.id);
  if (new Set(ids).size !== ids.length) errs.push("choice ids must be unique");

  const labels = s.choices.map((c) => c.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) errs.push("choice labels must be unique");

  for (const c of s.choices) {
    if (ORDER_DEPENDENT.test(c.label)) {
      errs.push(`choice "${c.id}" is not shuffle-safe (refers to order/other choices)`);
    }
  }

  if (new Set(s.ageBands).size !== s.ageBands.length) errs.push("ageBands has duplicates");
  if (new Set(s.tags).size !== s.tags.length) errs.push("tags has duplicates");

  const others = promptAddressees(s.prompt).filter((p) => p !== s.position);
  if (others.length) {
    errs.push(`prompt addresses ${others.join(", ")} but position is ${s.position} (single POV)`);
  }

  const { runners } = s.gameState;
  for (const m of s.sequence.runnerMotion) {
    if (m.from !== "home" && !runners[m.from]) {
      errs.push(`runnerMotion from ${m.from} but no runner is on ${m.from}`);
    }
  }
  for (const c of s.choices) {
    for (const r of c.outcome.animation.runners) {
      if (r.from !== "home" && !runners[r.from]) {
        errs.push(`choice "${c.id}" outcome moves a runner from empty base ${r.from}`);
      }
    }
  }

  if (s.sequence.freeze.mode === "after" && s.sequence.freeze.at !== undefined) {
    errs.push("freeze.at is only valid with freeze.mode = in-flight");
  }

  if (s.side === "defense" && s.choices.some((c) => c.outcome.kind === "steal" && c.correct)) {
    errs.push("a correct defensive choice cannot have outcome kind 'steal'");
  }

  return errs;
}

export function validateBank(items: unknown[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const situations: Situation[] = [];
  const seen = new Set<string>();

  items.forEach((raw, i) => {
    const rawId =
      raw && typeof raw === "object" && "id" in raw && typeof raw.id === "string"
        ? raw.id
        : `#${i}`;
    const parsed = SituationSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({ id: rawId, message: `${issue.path.join(".") || "(root)"}: ${issue.message}` });
      }
      return;
    }
    const s = parsed.data;
    if (seen.has(s.id)) issues.push({ id: s.id, message: "duplicate id" });
    seen.add(s.id);
    for (const message of checkSituation(s)) issues.push({ id: s.id, message });
    situations.push(s);
  });

  return { ok: issues.length === 0, issues, situations };
}
