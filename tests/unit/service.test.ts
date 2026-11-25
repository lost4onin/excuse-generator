import { describe, expect, it, vi } from "vitest";
import type { Excuse, WeatherSummary } from "@/lib/domain";
import { demoEvents, type EventsProvider } from "@/lib/events";
import type { FormInput } from "@/lib/form";
import { seeded } from "@/lib/random";
import { err, ok } from "@/lib/result";
import { buildContext, generate, type ExcuseWriter } from "@/lib/service";
import { fakeWeather, type Geocoder } from "@/lib/weather";

const input: FormInput = {
  reason: "team meeting",
  mode: "late",
  minutesLate: 10,
  localTime: "2026-11-25T08:30",
  localHour: 8,
  weekday: 3,
  audience: "boss",
};

const rain: WeatherSummary = {
  quality: "live",
  temperatureC: 9,
  precipitationProbability: 90,
  code: 63,
  description: "rain",
  isRaining: true,
};

const geocoder: Geocoder = {
  find: (city) =>
    Promise.resolve(
      city === "Tunis"
        ? ok({ name: "Tunis", coords: { latitude: 36.82, longitude: 10.17 } })
        : err("not_found", "no"),
    ),
};

const brokenEvents: EventsProvider = { near: () => Promise.resolve(err("upstream", "down")) };

describe("buildContext", () => {
  it("works with no place at all", async () => {
    const ctx = await buildContext(
      input,
      { kind: "none" },
      {
        weather: fakeWeather(rain),
        geocoder,
        events: demoEvents,
      },
    );
    expect(ctx.place).toBeUndefined();
    expect(ctx.weather).toBeUndefined();
    expect(ctx.events).toBeUndefined();
    expect(ctx.traffic?.quality).toBe("estimated");
  });

  it("geocodes a city and gathers weather, traffic and events", async () => {
    const ctx = await buildContext(
      input,
      { kind: "city", city: "Tunis" },
      {
        weather: fakeWeather(rain),
        geocoder,
        events: demoEvents,
      },
    );
    expect(ctx.place).toEqual({ city: "Tunis", latitude: 36.82, longitude: 10.17 });
    expect(ctx.weather).toEqual(rain);
    expect(ctx.traffic?.level).toBe("heavy");
    expect(ctx.events?.quality).toBe("demo");
  });

  it("keeps going when every upstream fails", async () => {
    const ctx = await buildContext(
      input,
      { kind: "city", city: "Atlantis" },
      {
        weather: fakeWeather(null),
        geocoder,
        events: brokenEvents,
      },
    );
    expect(ctx.place).toEqual({ city: "Atlantis" });
    expect(ctx.weather).toBeUndefined();
    expect(ctx.events).toBeUndefined();
  });
});

const ctxBase = {
  reason: "team meeting",
  mode: "late" as const,
  minutesLate: 10,
  time: "2026-11-25T13:00",
  localHour: 13,
  weekday: 3,
  audience: "boss" as const,
};

const excuse = (tier: Excuse["tier"]): Excuse => ({
  tier,
  text: `${tier} text`,
  tag: "none",
  flags: [],
});

describe("generate", () => {
  it("uses the writer when it succeeds", async () => {
    const writer: ExcuseWriter = {
      write: () => Promise.resolve(ok([excuse("safe"), excuse("creative"), excuse("bold")])),
    };
    const set = await generate(ctxBase, [], { writer, rng: seeded(1) });
    expect(set.source).toBe("llm");
  });

  it("falls back to templates when the writer fails", async () => {
    const writer: ExcuseWriter = { write: () => Promise.resolve(err("upstream", "429")) };
    const set = await generate(ctxBase, [], { writer, rng: seeded(1) });
    expect(set.source).toBe("templates");
    expect(set.excuses).toHaveLength(3);
  });

  it("uses templates when no writer is configured", async () => {
    expect((await generate(ctxBase, [], { writer: null, rng: seeded(1) })).source).toBe(
      "templates",
    );
  });

  it("refuses harmful reasons without calling the writer", async () => {
    const write = vi.fn<ExcuseWriter["write"]>();
    const set = await generate({ ...ctxBase, reason: "robbing the corner shop" }, [], {
      writer: { write },
      rng: seeded(1),
    });
    expect(set.source).toBe("refusal");
    expect(write).not.toHaveBeenCalled();
  });
});
