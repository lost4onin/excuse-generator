import { z } from "zod";
import type { NearbyEvent } from "@/lib/domain";
import type { EventsProvider } from "@/lib/events";
import { getJson, type Fetcher } from "@/lib/http";
import { err, ok } from "@/lib/result";

const BASE = "https://app.ticketmaster.com/discovery/v2/events.json";

const eventSchema = z.object({
  name: z.string().max(300),
  url: z.unknown().optional(),
  dates: z.object({
    start: z.object({
      localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      localTime: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/)
        .optional(),
    }),
  }),
  _embedded: z
    .object({ venues: z.array(z.object({ name: z.string().max(200).optional() })).max(5) })
    .optional(),
});

/** Only https links are kept; anything else is dropped, not the whole event. */
const safeUrl = z.url({ protocol: /^https$/ }).max(500);

const responseSchema = z.object({
  _embedded: z.object({ events: z.array(z.unknown()).max(50) }).optional(),
});

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Pure: turn a Discovery response into events; drops entries that fail validation. */
export function parseEvents(raw: unknown): NearbyEvent[] | null {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const out: NearbyEvent[] = [];
  for (const item of parsed.data._embedded?.events ?? []) {
    const e = eventSchema.safeParse(item);
    if (!e.success) continue;
    const { localDate, localTime } = e.data.dates.start;
    const url = safeUrl.safeParse(e.data.url);
    out.push({
      name: e.data.name,
      venue: e.data._embedded?.venues[0]?.name ?? "a venue nearby",
      startsAt: `${localDate}T${(localTime ?? "12:00").slice(0, 5)}`,
      ...(url.success ? { url: url.data } : {}),
    });
  }
  return out;
}

/**
 * Adapter: Ticketmaster Discovery API v2, enabled when TICKETMASTER_API_KEY is
 * set. Asks for a three-day UTC window around the local date and leaves the
 * overlap check to the engine. Results are not cached.
 */
export function ticketmaster(fetcher: Fetcher, apiKey: string): EventsProvider {
  return {
    async near({ coords, city, localTime }) {
      const date = localTime.slice(0, 10);
      const q = new URLSearchParams({
        apikey: apiKey,
        radius: "15",
        unit: "km",
        size: "20",
        sort: "date,asc",
        startDateTime: `${shiftDate(date, -1)}T00:00:00Z`,
        endDateTime: `${shiftDate(date, 1)}T23:59:59Z`,
      });
      if (coords) q.set("latlong", `${String(coords.latitude)},${String(coords.longitude)}`);
      else if (city) q.set("city", city);
      else return err("validation", "Events need a place");

      const r = await getJson(fetcher, `${BASE}?${q.toString()}`, { timeoutMs: 4000, retries: 1 });
      if (!r.ok) return r;
      const events = parseEvents(r.value);
      if (!events) return err("upstream", "Events response had an unexpected shape");
      return ok({ quality: "live", events });
    },
  };
}
