import type { Excuse, ExcuseContext, ExcuseSet, Place } from "@/lib/domain";
import type { EventsProvider } from "@/lib/events";
import type { FormInput } from "@/lib/form";
import type { Coords } from "@/lib/place";
import type { Rng } from "@/lib/random";
import type { Result } from "@/lib/result";
import { isHarmfulReason, refusalSet } from "@/lib/safety";
import { templateExcuses } from "@/lib/templates";
import { estimateTraffic } from "@/lib/traffic";
import type { Geocoder, WeatherClient } from "@/lib/weather";

/** Port: something that writes three excuses (the LLM adapter, later). */
export interface ExcuseWriter {
  write(ctx: ExcuseContext, avoid: readonly string[]): Promise<Result<[Excuse, Excuse, Excuse]>>;
}

export type PlaceInput =
  { kind: "coords"; coords: Coords } | { kind: "city"; city: string } | { kind: "none" };

export interface ContextDeps {
  weather: WeatherClient;
  geocoder: Geocoder;
  events: EventsProvider;
}

/**
 * Gathers whatever context is available. Each source fails on its own and
 * simply leaves its field empty: the engine works with none of them.
 */
export async function buildContext(
  input: FormInput,
  placeInput: PlaceInput,
  deps: ContextDeps,
): Promise<ExcuseContext> {
  let place: Place | undefined;
  let coords: Coords | undefined;
  if (placeInput.kind === "coords") {
    coords = placeInput.coords;
    place = { city: "your area", ...coords };
  } else if (placeInput.kind === "city") {
    const g = await deps.geocoder.find(placeInput.city);
    if (g.ok) {
      coords = g.value.coords;
      place = { city: g.value.name, ...coords };
    } else {
      place = { city: placeInput.city };
    }
  }

  const [weatherR, eventsR] = await Promise.all([
    coords ? deps.weather.at(coords, input.localTime) : Promise.resolve(null),
    coords || place
      ? deps.events.near({
          ...(coords ? { coords } : {}),
          ...(place ? { city: place.city } : {}),
          localTime: input.localTime,
        })
      : Promise.resolve(null),
  ]);
  const weather = weatherR?.ok ? weatherR.value : undefined;
  const events = eventsR?.ok ? eventsR.value : undefined;
  const traffic = estimateTraffic({ localHour: input.localHour, weekday: input.weekday, weather });

  return {
    reason: input.reason,
    mode: input.mode,
    ...(input.minutesLate !== undefined ? { minutesLate: input.minutesLate } : {}),
    time: input.localTime,
    localHour: input.localHour,
    weekday: input.weekday,
    audience: input.audience,
    traffic,
    ...(place ? { place } : {}),
    ...(weather ? { weather } : {}),
    ...(events ? { events } : {}),
  };
}

export interface GenerateDeps {
  writer: ExcuseWriter | null;
  rng: Rng;
}

/**
 * Always three excuses. Harmful reasons get a refusal and never reach the
 * writer; any writer failure falls back to templates ("Offline mode").
 */
export async function generate(
  ctx: ExcuseContext,
  avoid: readonly string[],
  { writer, rng }: GenerateDeps,
): Promise<ExcuseSet> {
  if (isHarmfulReason(ctx.reason)) return refusalSet();
  if (writer) {
    const r = await writer.write(ctx, avoid);
    if (r.ok) return { source: "llm", excuses: r.value };
  }
  return templateExcuses(ctx, rng);
}
