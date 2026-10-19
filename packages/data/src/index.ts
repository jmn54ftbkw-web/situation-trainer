import type { AgeBand, Position } from "@st/content";

/** A finished Train session as stored. No personal data in v1 (see ADR 0004). */
export interface SessionRecord {
  id: string;
  finishedAt: string;
  ageBand: AgeBand;
  position: Position;
  plays: number;
  correct: number;
  stars: number;
  score: number;
  level: string;
  situationIds: string[];
}

export interface Preferences {
  ageBand?: AgeBand;
  position?: Position;
  reducedMotion?: boolean;
}

/**
 * Storage boundary. UI code depends only on this interface; adapters decide where data lives
 * (device today, Supabase once accounts land).
 */
export interface ProgressStore {
  saveSession(record: SessionRecord): Promise<void>;
  listSessions(limit?: number): Promise<SessionRecord[]>;
  getPreferences(): Promise<Preferences>;
  setPreferences(p: Preferences): Promise<void>;
  clear(): Promise<void>;
}

const MAX_SESSIONS = 200;

export class MemoryProgressStore implements ProgressStore {
  protected sessions: SessionRecord[] = [];
  protected prefs: Preferences = {};

  async saveSession(record: SessionRecord): Promise<void> {
    this.sessions = [record, ...this.sessions].slice(0, MAX_SESSIONS);
    this.persist();
  }
  async listSessions(limit = MAX_SESSIONS): Promise<SessionRecord[]> {
    return this.sessions.slice(0, limit);
  }
  async getPreferences(): Promise<Preferences> {
    return { ...this.prefs };
  }
  async setPreferences(p: Preferences): Promise<void> {
    this.prefs = { ...this.prefs, ...p };
    this.persist();
  }
  async clear(): Promise<void> {
    this.sessions = [];
    this.prefs = {};
    this.persist();
  }
  protected persist(): void {}
}

/** Minimal Storage surface so tests can pass a fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class LocalProgressStore extends MemoryProgressStore {
  static readonly KEY = "st.progress.v1";

  constructor(private readonly storage: KeyValueStorage) {
    super();
    try {
      const raw = storage.getItem(LocalProgressStore.KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { sessions?: SessionRecord[]; prefs?: Preferences };
        this.sessions = parsed.sessions ?? [];
        this.prefs = parsed.prefs ?? {};
      }
    } catch {
      // Corrupt or unavailable storage: start fresh rather than break the drill.
    }
  }

  protected override persist(): void {
    try {
      this.storage.setItem(
        LocalProgressStore.KEY,
        JSON.stringify({ sessions: this.sessions, prefs: this.prefs }),
      );
    } catch {
      // Quota/private mode: progress is best-effort on device.
    }
  }
}

/** Placeholder for phase 6 (accounts). Implements the same interface against Supabase. */
export function createSupabaseProgressStore(): ProgressStore {
  throw new Error("Supabase adapter not implemented yet (phase 6, see ADR 0004)");
}

export function createDeviceStore(): ProgressStore {
  if (typeof localStorage === "undefined") return new MemoryProgressStore();
  return new LocalProgressStore(localStorage);
}
