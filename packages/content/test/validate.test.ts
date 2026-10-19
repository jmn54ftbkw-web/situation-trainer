import { describe, expect, it } from "vitest";
import { bank } from "../src/index.ts";
import { promptAddressees, validateBank } from "../src/validate.ts";
import type { Situation } from "../src/schema.ts";

const clone = (s: Situation): Situation => structuredClone(s) as Situation;
const base = bank[0]!;

describe("bank", () => {
  it("has the 17 migrated legacy situations and all validate", () => {
    const res = validateBank([...bank]);
    expect(res.issues).toEqual([]);
    expect(bank.length).toBe(17);
  });

  it("gives every position at least one POV item", () => {
    for (const p of ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]) {
      expect(bank.some((s) => s.position === p)).toBe(true);
    }
  });
});

describe("validateBank", () => {
  it("rejects schema violations (multi-position array)", () => {
    const bad = { ...clone(base), position: ["SS", "2B"] };
    const res = validateBank([bad]);
    expect(res.ok).toBe(false);
    expect(res.issues[0]?.message).toMatch(/^position/);
  });

  it("requires every choice to have an outcome", () => {
    const s = clone(base) as unknown as { choices: Record<string, unknown>[] };
    delete s.choices[0]!.outcome;
    expect(validateBank([s]).ok).toBe(false);
  });

  it("flags duplicate ids", () => {
    const res = validateBank([clone(base), clone(base)]);
    expect(res.issues.map((i) => i.message)).toContain("duplicate id");
  });

  it("requires a correct choice and unique choice ids/labels", () => {
    const s = clone(base);
    s.choices.forEach((c) => (c.correct = false));
    s.choices[1]!.id = s.choices[0]!.id;
    s.choices[1]!.label = s.choices[0]!.label;
    const msgs = validateBank([s]).issues.map((i) => i.message);
    expect(msgs).toContain("needs at least one correct choice");
    expect(msgs).toContain("choice ids must be unique");
    expect(msgs).toContain("choice labels must be unique");
  });

  it("rejects order-dependent labels", () => {
    const s = clone(base);
    s.choices[0]!.label = "All of the above";
    expect(validateBank([s]).issues[0]?.message).toMatch(/shuffle-safe/);
  });

  it("enforces single POV in the prompt", () => {
    const s = clone(base);
    s.position = "C";
    s.prompt = "Grounder to first. Right field — what do you do?";
    expect(validateBank([s]).issues[0]?.message).toMatch(/addresses RF but position is C/);
  });

  it("rejects runners moving from empty bases", () => {
    const s = clone(base);
    s.gameState.runners = { "1B": false, "2B": false, "3B": false };
    const msgs = validateBank([s]).issues.map((i) => i.message);
    expect(msgs.some((m) => m.startsWith("runnerMotion from 1B"))).toBe(true);
    expect(msgs.some((m) => m.includes("empty base 1B"))).toBe(true);
  });

  it("rejects freeze.at with mode after", () => {
    const s = clone(base);
    s.sequence.freeze = { mode: "after", at: 0.5 };
    expect(validateBank([s]).issues[0]?.message).toMatch(/freeze.at/);
  });

  it("rejects duplicate tags/age bands and correct defensive steals", () => {
    const s = clone(base);
    s.tags = ["force-play", "force-play"];
    s.ageBands = ["8U-10U", "8U-10U"];
    s.choices.find((c) => c.correct)!.outcome.kind = "steal";
    const msgs = validateBank([s]).issues.map((i) => i.message);
    expect(msgs).toEqual(
      expect.arrayContaining([
        "tags has duplicates",
        "ageBands has duplicates",
        "a correct defensive choice cannot have outcome kind 'steal'",
      ]),
    );
  });

  it("reports non-object input by index", () => {
    expect(validateBank([42]).issues[0]?.id).toBe("#0");
  });
});

describe("promptAddressees", () => {
  it("detects direct address, 'as the', and 'you're the'", () => {
    expect(promptAddressees("Left field — where do you go?")).toEqual(["LF"]);
    expect(promptAddressees("As the catcher, what now?")).toEqual(["C"]);
    expect(promptAddressees("You're the shortstop. Go.")).toEqual(["SS"]);
    expect(promptAddressees("Grounder to first base.")).toEqual([]);
  });
});
