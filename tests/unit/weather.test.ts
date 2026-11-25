import { describe, expect, it, vi } from "vitest";
import type { Fetcher } from "@/lib/http";
import { describeCode, isWet, openMeteo, summarise } from "@/lib/weather";
import forecast from "../fixtures/open-meteo-forecast.json";
import geocode from "../fixtures/open-meteo-geocode.json";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("summarise", () => {
  it("picks the matching local hour", () => {
    const r = summarise(forecast, "2026-11-25T09:40");
    expect(r).toEqual({
      ok: true,
      value: {
        quality: "live",
        temperatureC: 14,
        precipitationProbability: 75,
        code: 61,
        description: "rain",
        isRaining: true,
      },
    });
  });

  it("reports a dry hour as dry", () => {
    const r = summarise(forecast, "2026-11-25T08:05");
    expect(r.ok && r.value.isRaining).toBe(false);
  });

  it("returns not_found outside the forecast window", () => {
    const r = summarise(forecast, "2027-01-01T09:00");
    expect(!r.ok && r.error.kind).toBe("not_found");
  });

  it("rejects malformed payloads", () => {
    const r = summarise({ hourly: { time: ["x"], temperature_2m: [] } }, "2026-11-25T09:00");
    expect(!r.ok && r.error.kind).toBe("upstream");
  });
});

describe("weather codes", () => {
  it("describes and classifies", () => {
    expect(describeCode(0)).toBe("clear sky");
    expect(describeCode(95)).toBe("thunderstorm");
    expect(isWet(0, 10)).toBe(false);
    expect(isWet(0, 70)).toBe(true);
    expect(isWet(81, 0)).toBe(true);
  });
});

describe("openMeteo adapter", () => {
  it("calls the fixed host and caches", async () => {
    const fetcher = vi.fn<Fetcher>(() => json(forecast));
    const client = openMeteo(fetcher, { now: () => 0 });
    await client.at({ latitude: 36.8, longitude: 10.18 }, "2026-11-25T09:00");
    await client.at({ latitude: 36.8, longitude: 10.18 }, "2026-11-25T09:00");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  });

  it("retries once on 5xx, then reports upstream", async () => {
    const fetcher = vi.fn<Fetcher>(() => json({}, 503));
    const r = await openMeteo(fetcher, { now: () => 0 }).at(
      { latitude: 1, longitude: 1 },
      "2026-11-25T09:00",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(!r.ok && r.error.kind).toBe("upstream");
  });

  it("does not retry a 4xx", async () => {
    const fetcher = vi.fn<Fetcher>(() => json({}, 400));
    await openMeteo(fetcher, { now: () => 0 }).find("Tunis");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("geocodes a city to rounded coordinates", async () => {
    const fetcher = vi.fn<Fetcher>(() => json(geocode));
    const r = await openMeteo(fetcher, { now: () => 0 }).find("Tunis");
    expect(r).toEqual({
      ok: true,
      value: { name: "Tunis", coords: { latitude: 36.82, longitude: 10.17 } },
    });
    expect(fetcher.mock.calls[0]?.[0]).toContain("geocoding-api.open-meteo.com");
  });

  it("reports an unknown city as not_found", async () => {
    const fetcher = vi.fn<Fetcher>(() => json({ generationtime_ms: 0.1 }));
    const r = await openMeteo(fetcher, { now: () => 0 }).find("Nowhereville");
    expect(!r.ok && r.error.kind).toBe("not_found");
  });

  it("turns a network failure into an error value", async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.reject(new Error("offline")));
    const r = await openMeteo(fetcher, { now: () => 0 }).find("Tunis");
    expect(!r.ok && r.error.kind).toBe("upstream");
  });
});
