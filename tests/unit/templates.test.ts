import { describe, expect, it } from "vitest";
import { AUDIENCES, MODES, type ExcuseContext, type WeatherSummary } from "@/lib/domain";
import { seeded } from "@/lib/random";
import { isHarmfulReason, refusalSet } from "@/lib/safety";
import { estimateTraffic } from "@/lib/traffic";
import { templateExcuses } from "@/lib/templates";

const base: ExcuseContext = {
  reason: "team meeting",
  mode: "late",
  minutesLate: 15,
  time: "2026-11-25T13:00",
  localHour: 13,
  weekday: 3,
  audience: "boss",
};

const rain: WeatherSummary = {
  quality: "live",
  temperatureC: 11,
  precipitationProbability: 85,
  code: 63,
  description: "rain",
  isRaining: true,
};
const clear: WeatherSummary = {
  ...rain,
  precipitationProbability: 0,
  code: 0,
  description: "clear sky",
  isRaining: false,
};

describe("templateExcuses", () => {
  it("always returns safe, creative, bold for every audience and mode, with no context", () => {
    for (const audience of AUDIENCES) {
      for (const mode of MODES) {
        for (let seed = 0; seed < 20; seed++) {
          const set = templateExcuses({ ...base, audience, mode }, seeded(seed));
          expect(set.source).toBe("templates");
          expect(set.excuses.map((e) => e.tier)).toEqual(["safe", "creative", "bold"]);
          for (const e of set.excuses) {
            expect(e.text.length).toBeGreaterThan(10);
            expect(e.tag).toBe("none");
          }
        }
      }
    }
  });

  it("is deterministic for a seed", () => {
    expect(templateExcuses(base, seeded(7))).toEqual(templateExcuses(base, seeded(7)));
  });

  it("keeps safe excuses short", () => {
    for (let seed = 0; seed < 50; seed++) {
      const ctx = {
        ...base,
        weather: rain,
        traffic: estimateTraffic({ localHour: 8, weekday: 3, weather: rain }),
      };
      const safe = templateExcuses(ctx, seeded(seed)).excuses[0];
      expect(safe.text.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });

  it("never mentions rain on a clear day", () => {
    for (let seed = 0; seed < 50; seed++) {
      const set = templateExcuses({ ...base, weather: clear }, seeded(seed));
      for (const e of set.excuses) {
        expect(e.tag).not.toBe("weather");
        expect(e.text).not.toMatch(/rain|umbrella|damp/i);
      }
    }
  });

  it("uses rain in the creative slip when it is raining", () => {
    const set = templateExcuses({ ...base, weather: rain }, seeded(1));
    expect(set.excuses[1].tag).toBe("weather");
    expect(set.excuses[1].text).toContain("rain");
  });

  it("only blames traffic in a rush window, and stamps it estimated", () => {
    const calm = { ...base, traffic: estimateTraffic({ localHour: 13, weekday: 3 }) };
    for (let seed = 0; seed < 30; seed++) {
      for (const e of templateExcuses(calm, seeded(seed)).excuses)
        expect(e.tag).not.toBe("traffic");
    }
    const rush = {
      ...base,
      localHour: 8,
      time: "2026-11-25T08:00",
      traffic: estimateTraffic({ localHour: 8, weekday: 3 }),
    };
    const creative = templateExcuses(rush, seeded(3)).excuses[1];
    expect(creative.tag).toBe("traffic");
    expect(creative.flags).toEqual(["estimated"]);
  });

  it("uses a live event only when it overlaps the time", () => {
    const events = {
      quality: "live" as const,
      events: [{ name: "Derby Night", venue: "the main stadium", startsAt: "2026-11-25T19:00" }],
    };
    const far = templateExcuses({ ...base, events }, seeded(2));
    for (const e of far.excuses) expect(e.tag).not.toBe("event");

    const near = templateExcuses(
      { ...base, time: "2026-11-25T18:30", localHour: 18, events },
      seeded(2),
    ).excuses[1];
    expect(near.tag).toBe("event");
    expect(near.text).toContain("Derby Night");
    expect(near.flags).toEqual([]);
  });

  it("never tells a demo event as fact", () => {
    const events = {
      quality: "demo" as const,
      events: [{ name: "Derby Night", venue: "the main stadium", startsAt: "2026-11-25T19:00" }],
    };
    for (let seed = 0; seed < 30; seed++) {
      const set = templateExcuses(
        { ...base, time: "2026-11-25T18:30", localHour: 18, events },
        seeded(seed),
      );
      for (const e of set.excuses) expect(e.text).not.toContain("Derby Night");
    }
  });

  it("keeps casual stories away from formal audiences when absent", () => {
    for (let seed = 0; seed < 30; seed++) {
      const set = templateExcuses({ ...base, mode: "absent", audience: "teacher" }, seeded(seed));
      expect(set.excuses[0].text).not.toMatch(/rain check/i);
    }
  });
});

describe("safety", () => {
  it("flags reasons about harm or crime", () => {
    for (const r of ["robbing a bank", "I need an alibi", "hide the body", "shoplifting trip"]) {
      expect(isHarmfulReason(r)).toBe(true);
    }
  });

  it("lets ordinary reasons through", () => {
    for (const r of [
      "team meeting",
      "dinner with Sam",
      "chemistry class",
      "night shift",
      "gunther's party",
    ]) {
      expect(isHarmfulReason(r)).toBe(false);
    }
  });

  it("refusal still has three slips", () => {
    const set = refusalSet();
    expect(set.source).toBe("refusal");
    expect(set.excuses).toHaveLength(3);
  });
});
