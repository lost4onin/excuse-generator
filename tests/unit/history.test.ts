import { describe, expect, it } from "vitest";
import {
  addEntry,
  decodeHistory,
  encodeHistory,
  localHistoryStore,
  repeatedPairs,
  repeatRisk,
  STORAGE_KEY,
  type HistoryEntry,
} from "@/lib/history";

const now = new Date("2026-11-25T12:00:00Z");
const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: "a",
  at: "2026-11-24T09:00:00.000Z",
  audience: "boss",
  reason: "standup",
  tier: "creative",
  tag: "traffic",
  text: "Stuck in traffic.",
  ...over,
});

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("history codec", () => {
  it("round-trips", () => {
    const list = [entry()];
    expect(decodeHistory(encodeHistory(list))).toEqual(list);
  });

  it("drops junk and malformed entries", () => {
    expect(decodeHistory("{not json")).toEqual([]);
    expect(decodeHistory(JSON.stringify({ version: 2, entries: [] }))).toEqual([]);
    const mixed = JSON.stringify({ version: 1, entries: [entry(), { text: "<script>" }] });
    expect(decodeHistory(mixed)).toHaveLength(1);
  });
});

describe("addEntry", () => {
  it("keeps the last ten, newest first, without duplicates", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < 12; i++)
      list = addEntry(list, entry({ id: String(i), text: `t${String(i)}` }));
    expect(list).toHaveLength(10);
    expect(list[0]?.id).toBe("11");
    list = addEntry(list, entry({ id: "dup", text: "t5" }));
    expect(list.filter((e) => e.text === "t5")).toHaveLength(1);
    expect(list[0]?.id).toBe("dup");
  });
});

describe("repeatRisk", () => {
  it("warns on same audience and same angle within two weeks", () => {
    const list = [entry()];
    expect(repeatRisk(list, "boss", { tag: "traffic", text: "Other words" }, now)).toHaveLength(1);
    expect(repeatRisk(list, "friend", { tag: "traffic", text: "x" }, now)).toHaveLength(0);
    expect(repeatRisk(list, "boss", { tag: "weather", text: "x" }, now)).toHaveLength(0);
  });

  it("forgets after the window", () => {
    const old = [entry({ at: "2026-10-01T09:00:00.000Z" })];
    expect(repeatRisk(old, "boss", { tag: "traffic", text: "x" }, now)).toHaveLength(0);
  });

  it("matches context-free excuses by text", () => {
    const list = [entry({ tag: "none", text: "Bus was slow." })];
    expect(repeatRisk(list, "boss", { tag: "none", text: "Bus was slow." }, now)).toHaveLength(1);
    expect(repeatRisk(list, "boss", { tag: "none", text: "Keys locked in." }, now)).toHaveLength(0);
  });

  it("finds repeats already in the drawer", () => {
    const list = [entry({ id: "new", text: "A" }), entry({ id: "old", text: "B" })];
    expect(repeatedPairs(list, now).map((e) => e.id)).toEqual(["new"]);
  });
});

describe("localHistoryStore", () => {
  it("saves, loads and clears", () => {
    const mem = new MemoryStorage();
    const store = localHistoryStore(() => mem as unknown as Storage);
    store.save([entry()]);
    expect(store.load()).toHaveLength(1);
    store.save([]);
    expect(mem.data.has(STORAGE_KEY)).toBe(false);
  });

  it("survives a storage that throws", () => {
    const store = localHistoryStore(() => {
      throw new Error("denied");
    });
    expect(store.load()).toEqual([]);
    expect(() => {
      store.save([entry()]);
    }).not.toThrow();
  });
});
