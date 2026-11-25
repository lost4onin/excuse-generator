import { z } from "zod";
import type { WeatherSummary } from "@/lib/domain";
import { getJson, type Fetcher } from "@/lib/http";
import type { Coords } from "@/lib/place";
import { err, ok, type Result } from "@/lib/result";

/** Port: weather at a place for a local wall-clock hour ("YYYY-MM-DDTHH:mm"). */
export interface WeatherClient {
  at(coords: Coords, localTime: string): Promise<Result<WeatherSummary>>;
}

/** Port: city name to coordinates. */
export interface Geocoder {
  find(city: string): Promise<Result<{ name: string; coords: Coords }>>;
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

const forecastSchema = z.object({
  hourly: z
    .object({
      time: z.array(z.string()).max(400),
      temperature_2m: z.array(z.number().nullable()),
      precipitation_probability: z.array(z.number().nullable()),
      weather_code: z.array(z.number().int().nullable()),
    })
    .refine(
      (h) =>
        h.time.length === h.temperature_2m.length &&
        h.time.length === h.precipitation_probability.length &&
        h.time.length === h.weather_code.length,
      "hourly arrays differ in length",
    ),
});

const geocodeSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string().max(200),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    )
    .max(10)
    .optional(),
});

/** WMO weather interpretation codes, as documented by Open-Meteo. */
export function describeCode(code: number): string {
  if (code === 0) return "clear sky";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code === 85 || code === 86) return "snow showers";
  if (code >= 95) return "thunderstorm";
  return "unsettled weather";
}

export function isWet(code: number, precipitationProbability: number): boolean {
  const wetCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  return wetCode || precipitationProbability >= 60;
}

/** Pure: pick the forecast hour matching the local time and summarise it. */
export function summarise(raw: unknown, localTime: string): Result<WeatherSummary> {
  const parsed = forecastSchema.safeParse(raw);
  if (!parsed.success) return err("upstream", "Weather response had an unexpected shape");
  const hourKey = `${localTime.slice(0, 13)}:00`;
  const h = parsed.data.hourly;
  const i = h.time.indexOf(hourKey);
  if (i < 0) return err("not_found", "No forecast for that hour");
  const temperatureC = h.temperature_2m[i];
  const pp = h.precipitation_probability[i];
  const code = h.weather_code[i];
  if (temperatureC == null || pp == null || code == null) {
    return err("not_found", "Forecast hour is incomplete");
  }
  return ok({
    quality: "live",
    temperatureC: Math.round(temperatureC),
    precipitationProbability: pp,
    code,
    description: describeCode(code),
    isRaining: isWet(code, pp),
  });
}

interface Clock {
  now: () => number;
}

/** Adapter: Open-Meteo, no key. Responses are cached in memory for ten minutes. */
export function openMeteo(fetcher: Fetcher, clock: Clock): WeatherClient & Geocoder {
  const TTL = 10 * 60 * 1000;
  const MAX_ENTRIES = 200;
  const cache = new Map<string, { at: number; value: unknown }>();

  const cachedGet = async (url: string): Promise<Result<unknown>> => {
    const hit = cache.get(url);
    if (hit && clock.now() - hit.at < TTL) return ok(hit.value);
    const r = await getJson(fetcher, url, { timeoutMs: 4000, retries: 1 });
    if (r.ok) {
      if (cache.size >= MAX_ENTRIES) cache.clear();
      cache.set(url, { at: clock.now(), value: r.value });
    }
    return r;
  };

  return {
    async at(coords, localTime) {
      const q = new URLSearchParams({
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
        hourly: "temperature_2m,precipitation_probability,weather_code",
        timezone: "auto",
        forecast_days: "16",
      });
      const r = await cachedGet(`${FORECAST_URL}?${q.toString()}`);
      return r.ok ? summarise(r.value, localTime) : r;
    },
    async find(city) {
      const q = new URLSearchParams({ name: city, count: "1", language: "en", format: "json" });
      const r = await cachedGet(`${GEOCODE_URL}?${q.toString()}`);
      if (!r.ok) return r;
      const parsed = geocodeSchema.safeParse(r.value);
      if (!parsed.success) return err("upstream", "Geocoding response had an unexpected shape");
      const first = parsed.data.results?.[0];
      if (!first) return err("not_found", "City not found");
      return ok({
        name: first.name,
        coords: {
          latitude: Math.round(first.latitude * 100) / 100,
          longitude: Math.round(first.longitude * 100) / 100,
        },
      });
    },
  };
}

/** Fake for tests and offline development. */
export function fakeWeather(summary: WeatherSummary | null): WeatherClient {
  return {
    at: () => Promise.resolve(summary ? ok(summary) : err("upstream", "fake outage")),
  };
}
