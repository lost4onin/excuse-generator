import type { EventsResult, NearbyEvent } from "@/lib/domain";
import type { Coords } from "@/lib/place";
import { ok, type Result } from "@/lib/result";

export interface EventsQuery {
  coords?: Coords;
  city?: string;
  /** Local wall-clock time "YYYY-MM-DDTHH:mm". */
  localTime: string;
}

/** Port: events happening near a place around a time. */
export interface EventsProvider {
  near(query: EventsQuery): Promise<Result<EventsResult>>;
}

const DEMO: readonly { name: string; venue: string; startHour: number }[] = [
  { name: "Riverside Half Marathon", venue: "the river road", startHour: 8 },
  { name: "Farmers' Market Weekend", venue: "the old square", startHour: 9 },
  { name: "City Youth Orchestra Matinee", venue: "the municipal theatre", startHour: 15 },
  { name: "Derby Night", venue: "the main stadium", startHour: 19 },
  { name: "Indie Band Album Launch", venue: "the warehouse venue", startHour: 20 },
  { name: "Night Food Fair", venue: "the harbour car park", startHour: 18 },
];

/** Deterministic pick so the same day shows the same demo events. */
function dayIndex(localTime: string): number {
  const digits = localTime.slice(0, 10).replace(/-/g, "");
  let h = 0;
  for (const ch of digits) h = (h * 31 + Number(ch)) % 9973;
  return h;
}

/** Fallback when no Ticketmaster key is set. Always labelled "demo". */
export const demoEvents: EventsProvider = {
  near({ localTime }) {
    const start = dayIndex(localTime) % DEMO.length;
    const date = localTime.slice(0, 10);
    const events: NearbyEvent[] = [0, 1].map((k) => {
      const e = DEMO[(start + k * 3) % DEMO.length] ?? DEMO[0];
      const hour = String(e?.startHour ?? 12).padStart(2, "0");
      return { name: e?.name ?? "", venue: e?.venue ?? "", startsAt: `${date}T${hour}:00` };
    });
    return Promise.resolve(ok({ quality: "demo", events }));
  },
};

/** An event "overlaps" when it starts within three hours either side of the time. */
export function overlapping(events: NearbyEvent[], localTime: string): NearbyEvent[] {
  const toMinutes = (t: string) => {
    const d = Date.parse(`${t.slice(0, 16)}:00Z`);
    return Number.isNaN(d) ? null : d / 60000;
  };
  const at = toMinutes(localTime);
  if (at === null) return [];
  return events.filter((e) => {
    const s = toMinutes(e.startsAt);
    return s !== null && Math.abs(s - at) <= 180;
  });
}
