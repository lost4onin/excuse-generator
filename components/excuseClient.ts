import { z } from "zod";
import type { ExcuseResponse } from "@/lib/api";
import { TIERS } from "@/lib/domain";
import type { FormInput } from "@/lib/form";
import type { PlaceState } from "@/lib/place";
import { seeded } from "@/lib/random";
import { refusalSet, isHarmfulReason } from "@/lib/safety";
import { templateExcuses } from "@/lib/templates";
import { estimateTraffic } from "@/lib/traffic";

const excuseSchema = z.object({
  tier: z.enum(TIERS),
  text: z.string().min(1).max(600),
  tag: z.enum(["weather", "traffic", "event", "none"]),
  flags: z.array(z.enum(["live", "estimated", "demo"])).max(3),
});

const responseSchema = z.object({
  set: z.object({
    source: z.enum(["llm", "templates", "refusal"]),
    excuses: z.tuple([excuseSchema, excuseSchema, excuseSchema]),
  }),
  used: z.object({
    place: z.string().max(200).optional(),
    weather: z.string().max(200).optional(),
    traffic: z.object({ level: z.string().max(20), quality: z.literal("estimated") }).optional(),
    events: z
      .object({
        quality: z.enum(["live", "demo"]),
        names: z
          .array(
            z.object({ name: z.string().max(300), url: z.url({ protocol: /^https$/ }).optional() }),
          )
          .max(3),
      })
      .optional(),
  }),
});

export type RequestExcuses = (
  input: FormInput,
  place: PlaceState,
  avoid: string[],
  seed: number,
) => Promise<ExcuseResponse>;

function placeBody(place: PlaceState) {
  if (place.kind === "located") return { kind: "coords", ...place.coords };
  if (place.kind === "manual") return { kind: "city", city: place.city };
  return { kind: "none" };
}

/** Offline fallback in the browser: templates with only the estimated traffic. */
export function offlineExcuses(input: FormInput, seed: number): ExcuseResponse {
  const traffic = estimateTraffic({ localHour: input.localHour, weekday: input.weekday });
  const ctx = {
    reason: input.reason,
    mode: input.mode,
    ...(input.minutesLate !== undefined ? { minutesLate: input.minutesLate } : {}),
    time: input.localTime,
    localHour: input.localHour,
    weekday: input.weekday,
    audience: input.audience,
    traffic,
  };
  const set = isHarmfulReason(input.reason) ? refusalSet() : templateExcuses(ctx, seeded(seed));
  return { set, used: { traffic: { level: traffic.level, quality: "estimated" } } };
}

/**
 * Browser adapter for the excuse API. Never a dead end: network errors and
 * bad responses fall back to offline templates.
 */
export const requestExcuses: RequestExcuses = async (input, place, avoid, seed) => {
  try {
    const res = await fetch("/api/excuses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        form: {
          reason: input.reason,
          mode: input.mode,
          minutesLate: input.minutesLate !== undefined ? String(input.minutesLate) : "",
          localTime: input.localTime,
          audience: input.audience,
        },
        place: placeBody(place),
        avoid: avoid.slice(0, 10),
        seed,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return offlineExcuses(input, seed);
    const parsed = responseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : offlineExcuses(input, seed);
  } catch {
    return offlineExcuses(input, seed);
  }
};
