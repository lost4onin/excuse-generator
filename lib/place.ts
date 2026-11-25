import { z } from "zod";

export const CITY_MAX = 80;

/** Two decimals is about a kilometre: enough for weather, too coarse for a doorstep. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

export function coarsen(coords: Coords): Coords | null {
  const { latitude, longitude } = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude: roundCoord(latitude), longitude: roundCoord(longitude) };
}

const citySchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(2, "Type a city name.")
      .max(CITY_MAX, "That city name is too long.")
      .regex(/^[\p{L}\p{M}\s.'-]+$/u, "Letters, spaces, dots, apostrophes and dashes only."),
  );

export function validateCity(
  raw: string,
): { ok: true; city: string } | { ok: false; error: string } {
  const r = citySchema.safeParse(raw);
  if (r.success) return { ok: true, city: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? "Invalid city." };
}

/** Where the place came from; the UI shows a different note for each. */
export type PlaceState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "located"; coords: Coords }
  | { kind: "denied" }
  | { kind: "manual"; city: string };
