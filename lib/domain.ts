/** Core vocabulary. Pure types and constants, no I/O. */

export const AUDIENCES = ["boss", "teacher", "friend", "date", "family"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const TIERS = ["safe", "creative", "bold"] as const;
export type Tier = (typeof TIERS)[number];

export const MODES = ["late", "absent"] as const;
export type Mode = (typeof MODES)[number];

/** How trustworthy a piece of context is; drives the UI stamps. */
export type DataQuality = "live" | "estimated" | "demo";

export interface Place {
  city: string;
  /** Rounded coordinates, never sent to the LLM. */
  latitude?: number;
  longitude?: number;
}

export interface WeatherSummary {
  quality: "live";
  temperatureC: number;
  precipitationProbability: number;
  /** WMO weather code from Open-Meteo. */
  code: number;
  description: string;
  isRaining: boolean;
}

export type TrafficLevel = "light" | "moderate" | "heavy";

export interface TrafficEstimate {
  quality: "estimated";
  level: TrafficLevel;
  rushHour: boolean;
  reason: string;
}

export interface NearbyEvent {
  name: string;
  venue: string;
  startsAt: string;
  url?: string;
}

export interface EventsResult {
  quality: "live" | "demo";
  events: NearbyEvent[];
}

/** Everything the engine may use. Every field is optional by design. */
export interface ExcuseContext {
  reason: string;
  mode: Mode;
  minutesLate?: number;
  /** ISO time of the thing being missed or joined late. */
  time: string;
  /** Local hour 0-23 and weekday 0-6 (Sunday = 0) at that time. */
  localHour: number;
  weekday: number;
  audience: Audience;
  place?: Place;
  weather?: WeatherSummary;
  traffic?: TrafficEstimate;
  events?: EventsResult;
}

/** Which context facts an excuse leans on; used for flags and repeat checks. */
export type ContextTag = "weather" | "traffic" | "event" | "none";

export interface Excuse {
  tier: Tier;
  text: string;
  tag: ContextTag;
  /** Data qualities this excuse relied on, so the slip can stamp them. */
  flags: DataQuality[];
}

export type EngineSource = "llm" | "templates" | "refusal";

export interface ExcuseSet {
  excuses: [Excuse, Excuse, Excuse];
  source: EngineSource;
}

export function isAudience(value: unknown): value is Audience {
  return typeof value === "string" && (AUDIENCES as readonly string[]).includes(value);
}
