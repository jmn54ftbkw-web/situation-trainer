import { describe, expect, it } from "vitest";
import {
  createDeviceStore,
  createSupabaseProgressStore,
  LocalProgressStore,
  MemoryProgressStore,
  type KeyValueStorage,
  type SessionRecord,
} from "../src/index.ts";

const rec = (id: string): SessionRecord => ({
  id,
  finishedAt: "2026-01-01T00:00:00Z",
  ageBand: "8U-10U",
  position: "SS",
  plays: 3,
  correct: 2,
  stars: 5,
  score: 610,
  level: "Varsity",
  situationIds: ["a"],
});

class FakeStorage implements KeyValueStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error("quota");
    this.data.set(k, v);
  }
}

describe("stores", () => {
  it("memory store keeps newest first and merges prefs", async () => {
    const s = new MemoryProgressStore();
    await s.saveSession(rec("1"));
    await s.saveSession(rec("2"));
    expect((await s.listSessions()).map((r) => r.id)).toEqual(["2", "1"]);
    expect(await s.listSessions(1)).toHaveLength(1);
    await s.setPreferences({ ageBand: "12U-14U" });
    await s.setPreferences({ position: "C" });
    expect(await s.getPreferences()).toEqual({ ageBand: "12U-14U", position: "C" });
    await s.clear();
    expect(await s.listSessions()).toEqual([]);
  });

  it("local store round-trips and survives corrupt data / write failures", async () => {
    const storage = new FakeStorage();
    const a = new LocalProgressStore(storage);
    await a.saveSession(rec("1"));
    await a.setPreferences({ position: "P" });
    const b = new LocalProgressStore(storage);
    expect((await b.listSessions())[0]?.id).toBe("1");
    expect((await b.getPreferences()).position).toBe("P");

    storage.data.set(LocalProgressStore.KEY, "{not json");
    expect(await new LocalProgressStore(storage).listSessions()).toEqual([]);
    storage.data.set(LocalProgressStore.KEY, "{}");
    expect(await new LocalProgressStore(storage).getPreferences()).toEqual({});

    storage.failWrites = true;
    await expect(a.saveSession(rec("2"))).resolves.toBeUndefined();
  });

  it("device store falls back to memory without localStorage; supabase is stubbed", () => {
    expect(createDeviceStore()).toBeInstanceOf(MemoryProgressStore);
    expect(() => createSupabaseProgressStore()).toThrow(/not implemented/);
  });
});
