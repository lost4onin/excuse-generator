import { describe, expect, it } from "vitest";
import { demoEvents, overlapping } from "@/lib/events";

describe("demoEvents", () => {
  it("is labelled demo and stable for a day", async () => {
    const a = await demoEvents.near({ localTime: "2026-11-25T09:00" });
    const b = await demoEvents.near({ localTime: "2026-11-25T18:30" });
    expect(a.ok && a.value.quality).toBe("demo");
    expect(a).toEqual(b);
    if (a.ok) {
      expect(a.value.events).toHaveLength(2);
      for (const e of a.value.events) expect(e.startsAt.startsWith("2026-11-25T")).toBe(true);
    }
  });

  it("varies between days", async () => {
    const names = new Set<string>();
    for (let d = 10; d < 20; d++) {
      const r = await demoEvents.near({ localTime: `2026-11-${String(d)}T09:00` });
      if (r.ok) names.add(r.value.events[0]?.name ?? "");
    }
    expect(names.size).toBeGreaterThan(1);
  });
});

describe("overlapping", () => {
  const events = [
    { name: "A", venue: "v", startsAt: "2026-11-25T08:00" },
    { name: "B", venue: "v", startsAt: "2026-11-25T19:00" },
    { name: "C", venue: "v", startsAt: "2026-11-25T19:00:00+01:00" },
  ];

  it("keeps events within three hours", () => {
    expect(overlapping(events, "2026-11-25T09:30").map((e) => e.name)).toEqual(["A"]);
    expect(overlapping(events, "2026-11-25T17:00").map((e) => e.name)).toEqual(["B", "C"]);
  });

  it("ignores junk times", () => {
    expect(overlapping(events, "soon")).toEqual([]);
  });
});
