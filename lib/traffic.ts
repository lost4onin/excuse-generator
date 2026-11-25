import type { TrafficEstimate, TrafficLevel, WeatherSummary } from "@/lib/domain";

const LEVELS: readonly TrafficLevel[] = ["light", "moderate", "heavy"];

export interface TrafficInput {
  /** Local hour 0-23. */
  localHour: number;
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
  weather?: WeatherSummary;
}

const isWeekday = (d: number) => d >= 1 && d <= 5;
const isMorningRush = (h: number) => h >= 7 && h <= 9;
const isEveningRush = (h: number) => h >= 16 && h <= 18;

/**
 * There is no free live traffic source, so this is a guess from the clock and
 * the sky. Always "estimated": the UI must say so wherever it is shown.
 */
export function estimateTraffic({ localHour, weekday, weather }: TrafficInput): TrafficEstimate {
  const rushHour = isWeekday(weekday) && (isMorningRush(localHour) || isEveningRush(localHour));
  let level = 0;
  let reason: string;
  if (rushHour) {
    level = 2;
    reason = isMorningRush(localHour) ? "morning rush hour" : "evening rush hour";
  } else if (localHour >= 23 || localHour < 6) {
    level = 0;
    reason = "the roads are empty at this hour";
  } else if (isWeekday(weekday) || weekday === 6) {
    level = localHour >= 11 && localHour <= 19 ? 1 : 0;
    reason = level === 1 ? "steady daytime traffic" : "quiet roads";
  } else {
    reason = "a quiet Sunday";
  }
  if (weather?.isRaining) {
    level = Math.min(level + 1, 2);
    reason += ", made worse by the rain";
  }
  return { quality: "estimated", level: LEVELS[level] ?? "light", rushHour, reason };
}
