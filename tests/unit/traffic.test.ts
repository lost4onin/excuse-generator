import { describe, expect, it } from "vitest";
import type { WeatherSummary } from "@/lib/domain";
import { estimateTraffic } from "@/lib/traffic";

const rain: WeatherSummary = {
  quality: "live",
  temperatureC: 12,
  precipitationProbability: 80,
  code: 61,
  description: "rain",
  isRaining: true,
};

describe("estimateTraffic", () => {
  it.each([
    { localHour: 8, weekday: 3, level: "heavy", rushHour: true },
    { localHour: 17, weekday: 1, level: "heavy", rushHour: true },
    { localHour: 8, weekday: 0, level: "light", rushHour: false },
    { localHour: 13, weekday: 2, level: "moderate", rushHour: false },
    { localHour: 3, weekday: 4, level: "light", rushHour: false },
    { localHour: 14, weekday: 6, level: "moderate", rushHour: false },
  ])("hour $localHour on day $weekday is $level", ({ localHour, weekday, level, rushHour }) => {
    const t = estimateTraffic({ localHour, weekday });
    expect(t).toMatchObject({ quality: "estimated", level, rushHour });
  });

  it("rain bumps the level by one, capped at heavy", () => {
    expect(estimateTraffic({ localHour: 13, weekday: 2, weather: rain }).level).toBe("heavy");
    expect(estimateTraffic({ localHour: 8, weekday: 3, weather: rain }).level).toBe("heavy");
    expect(estimateTraffic({ localHour: 3, weekday: 3, weather: rain }).reason).toMatch(/rain/);
  });

  it("is always labelled estimated", () => {
    for (let h = 0; h < 24; h++) {
      expect(estimateTraffic({ localHour: h, weekday: 2 }).quality).toBe("estimated");
    }
  });
});
