import { describe, expect, it } from "vitest";
import { checkOutput } from "@/lib/checker";
import type { ExcuseContext } from "@/lib/domain";

const ctx: ExcuseContext = {
  reason: "standup",
  mode: "late",
  minutesLate: 15,
  time: "2026-11-25T08:30",
  localHour: 8,
  weekday: 3,
  audience: "boss",
  weather: {
    quality: "live",
    temperatureC: 10,
    precipitationProbability: 85,
    code: 63,
    description: "rain",
    isRaining: true,
  },
  traffic: { quality: "estimated", level: "heavy", rushHour: true, reason: "morning rush hour" },
};

const reply = (safe: string, creative: string, bold: string) =>
  JSON.stringify({
    excuses: [
      { tier: "bold", text: bold },
      { tier: "safe", text: safe },
      { tier: "creative", text: creative },
    ],
  });

const VALID = reply(
  "Running 15 minutes late, sorry. On my way.",
  "The rain turned the bus stop into a lake, so I waited for the next bus. Fifteen minutes behind.",
  "I lost a duel with a revolving door and had to go round twice more. Be there soon.",
);

describe("checkOutput", () => {
  it("accepts valid output, orders tiers and tags context", () => {
    const r = checkOutput(VALID, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.map((e) => e.tier)).toEqual(["safe", "creative", "bold"]);
      expect(r.value[1].tag).toBe("weather");
      expect(r.value[0].tag).toBe("none");
    }
  });

  it("accepts a fenced JSON reply", () => {
    expect(checkOutput("```json\n" + VALID + "\n```", ctx).ok).toBe(true);
  });

  it("flags traffic-based excuses as estimated", () => {
    const r = checkOutput(
      reply(
        "Stuck in rush hour traffic, 15 minutes out.",
        "Rush hour traffic had every lane crawling past the roundabout. Fifteen minutes late.",
        "I tried to outrun the traffic on foot and lost. Soon.",
      ),
      ctx,
    );
    expect(r.ok && r.value[1].flags).toEqual(["estimated"]);
  });

  it.each([
    ["invalid JSON", "Sure! Here are your excuses: ...", "invalid_json"],
    [
      "wrong count",
      JSON.stringify({ excuses: [{ tier: "safe", text: "Late, sorry." }] }),
      "schema",
    ],
    [
      "repeated tier",
      JSON.stringify({
        excuses: [
          { tier: "safe", text: "Late, sorry." },
          { tier: "safe", text: "Late again." },
          { tier: "bold", text: "Very late." },
        ],
      }),
      "schema",
    ],
    [
      "illness",
      reply("Running late, sorry.", "The rain soaked me through.", "I woke up with a fever."),
      "forbidden",
    ],
    [
      "police",
      reply("Running late, sorry.", "The rain made a mess.", "The police stopped our bus."),
      "forbidden",
    ],
    [
      "long safe tier",
      reply(
        "I am so sorry but it turns out that I am running quite a bit later than I expected this morning for reasons.",
        "The rain flooded the underpass.",
        "Bold.",
      ),
      "tier_rule",
    ],
    [
      "creative with two details",
      reply("Late, sorry.", "The rain made the rush hour traffic even worse.", "Bold thing."),
      "tier_rule",
    ],
  ])("rejects %s", (_name, raw, failure) => {
    const r = checkOutput(raw, ctx);
    expect(r.ok).toBe(false);
    expect(r.failure).toBe(failure);
  });

  it("rejects rain on a clear day", () => {
    const clear: ExcuseContext = {
      ...ctx,
      weather: {
        quality: "live",
        temperatureC: 18,
        precipitationProbability: 0,
        code: 0,
        description: "clear sky",
        isRaining: false,
      },
      traffic: { quality: "estimated", level: "light", rushHour: false, reason: "quiet roads" },
    };
    const r = checkOutput(
      reply("Late, sorry.", "A storm rolled in out of nowhere.", "A goose blocked my door."),
      clear,
    );
    expect(r.failure).toBe("contradiction");
  });

  it("rejects a traffic jam when traffic is light", () => {
    const light: ExcuseContext = {
      ...ctx,
      weather: undefined,
      traffic: { quality: "estimated", level: "light", rushHour: false, reason: "quiet roads" },
    };
    const r = checkOutput(reply("Stuck in traffic.", "A cat sat on my keys.", "Bold."), light);
    expect(r.failure).toBe("contradiction");
  });

  it("allows a context-free creative slip when there is no context", () => {
    const none: ExcuseContext = { ...ctx, weather: undefined, traffic: undefined };
    const r = checkOutput(
      reply("Late, sorry.", "My neighbour's parrot learned my alarm tone.", "Bold."),
      none,
    );
    expect(r.ok).toBe(true);
  });
});
