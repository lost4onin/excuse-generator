import { z } from "zod";
import { AUDIENCES, TIERS, type Audience, type ContextTag, type Excuse } from "@/lib/domain";

export const HISTORY_LIMIT = 10;
export const REPEAT_WINDOW_DAYS = 14;
export const STORAGE_KEY = "excuse-history:v1";

const entrySchema = z.object({
  id: z.string().max(40),
  at: z.iso.datetime(),
  audience: z.enum(AUDIENCES),
  reason: z.string().max(200),
  tier: z.enum(TIERS),
  tag: z.enum(["weather", "traffic", "event", "none"]),
  text: z.string().max(600),
});

export type HistoryEntry = z.infer<typeof entrySchema>;

const storedSchema = z.object({ version: z.literal(1), entries: z.array(z.unknown()).max(50) });

/** Reads stored history; anything malformed is dropped, never trusted. */
export function decodeHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const stored = storedSchema.safeParse(data);
  if (!stored.success) return [];
  return stored.data.entries
    .map((e) => entrySchema.safeParse(e))
    .flatMap((r) => (r.success ? [r.data] : []))
    .slice(0, HISTORY_LIMIT);
}

export function encodeHistory(entries: HistoryEntry[]): string {
  return JSON.stringify({ version: 1, entries: entries.slice(0, HISTORY_LIMIT) });
}

/** Newest first, capped, and the same text is never kept twice. */
export function addEntry(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries.filter((e) => e.text !== entry.text)].slice(0, HISTORY_LIMIT);
}

/** The "angle" of an excuse: its context hook, or the text itself when it has none. */
function angle(e: { tag: ContextTag; text: string }): string {
  return e.tag === "none" ? `text:${e.text}` : `tag:${e.tag}`;
}

/** Earlier entries told to the same audience with the same angle, within the window. */
export function repeatRisk(
  entries: HistoryEntry[],
  audience: Audience,
  excuse: Pick<Excuse, "tag" | "text">,
  now: Date,
): HistoryEntry[] {
  const since = now.getTime() - REPEAT_WINDOW_DAYS * 86_400_000;
  return entries.filter(
    (e) => e.audience === audience && angle(e) === angle(excuse) && Date.parse(e.at) >= since,
  );
}

/** Pairs in history that already repeat each other (same audience, same angle). */
export function repeatedPairs(entries: HistoryEntry[], now: Date): HistoryEntry[] {
  return entries.filter((e, i) => repeatRisk(entries.slice(i + 1), e.audience, e, now).length > 0);
}

/** Port: where history lives. The browser adapter uses localStorage. */
export interface HistoryStore {
  load(): HistoryEntry[];
  save(entries: HistoryEntry[]): void;
}

export function localHistoryStore(storage: () => Storage | null): HistoryStore {
  return {
    load() {
      try {
        return decodeHistory(storage()?.getItem(STORAGE_KEY) ?? null);
      } catch {
        return [];
      }
    },
    save(entries) {
      try {
        const s = storage();
        if (entries.length === 0) s?.removeItem(STORAGE_KEY);
        else s?.setItem(STORAGE_KEY, encodeHistory(entries));
      } catch {
        // Private mode or full storage: history is a convenience, not a promise.
      }
    },
  };
}
