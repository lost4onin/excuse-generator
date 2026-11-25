import { z } from "zod";
import type { ExcuseContext, ExcuseSet } from "@/lib/domain";
import { validateForm, type FormInput } from "@/lib/form";
import { coarsen, validateCity } from "@/lib/place";
import type { AppError, ErrorKind, Result } from "@/lib/result";
import { err, ok } from "@/lib/result";
import type { PlaceInput } from "@/lib/service";

export const MAX_BODY_BYTES = 4096;

const placeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("coords"),
    latitude: z.number(),
    longitude: z.number(),
  }),
  z.object({ kind: z.literal("city"), city: z.string().max(200) }),
  z.object({ kind: z.literal("none") }),
]);

const requestSchema = z.object({
  form: z.record(z.string(), z.string().max(400)),
  place: placeSchema,
  avoid: z.array(z.string().max(400)).max(10).default([]),
  seed: z
    .number()
    .int()
    .min(0)
    .max(2 ** 31)
    .optional(),
});

export interface ExcuseRequest {
  input: FormInput;
  place: PlaceInput;
  avoid: string[];
  seed?: number;
}

/** Validates the untrusted request body into domain input. */
export function parseRequest(body: unknown): Result<ExcuseRequest> {
  const r = requestSchema.safeParse(body);
  if (!r.success) return err("validation", "Malformed request");
  const form = validateForm(r.data.form);
  if (!form.ok) return err("validation", Object.values(form.errors)[0] ?? "Invalid form");

  let place: PlaceInput = { kind: "none" };
  const p = r.data.place;
  if (p.kind === "coords") {
    const c = coarsen(p);
    if (!c) return err("validation", "Invalid coordinates");
    place = { kind: "coords", coords: c };
  } else if (p.kind === "city") {
    const c = validateCity(p.city);
    if (!c.ok) return err("validation", c.error);
    place = { kind: "city", city: c.city };
  }
  return ok({
    input: form.value,
    place,
    avoid: r.data.avoid,
    ...(r.data.seed !== undefined ? { seed: r.data.seed } : {}),
  });
}

/** What the browser gets back: the slips plus a summary of what was used. */
export interface ExcuseResponse {
  set: ExcuseSet;
  used: {
    place?: string;
    weather?: string;
    traffic?: { level: string; quality: "estimated" };
    events?: { quality: "live" | "demo"; names: { name: string; url?: string }[] };
  };
}

export function toResponse(set: ExcuseSet, ctx: ExcuseContext): ExcuseResponse {
  return {
    set,
    used: {
      ...(ctx.place ? { place: ctx.place.city } : {}),
      ...(ctx.weather
        ? { weather: `${ctx.weather.description}, ${String(ctx.weather.temperatureC)}°C` }
        : {}),
      ...(ctx.traffic ? { traffic: { level: ctx.traffic.level, quality: "estimated" } } : {}),
      ...(ctx.events
        ? {
            events: {
              quality: ctx.events.quality,
              names: ctx.events.events
                .slice(0, 3)
                .map((e) => ({ name: e.name, ...(e.url ? { url: e.url } : {}) })),
            },
          }
        : {}),
    },
  };
}

const STATUS: Record<ErrorKind, number> = {
  validation: 400,
  not_found: 404,
  forbidden: 403,
  upstream: 502,
  internal: 500,
};

/** The one place errors become HTTP responses. Internals never leak. */
export function errorBody(e: AppError): {
  status: number;
  body: { error: { kind: ErrorKind; message: string } };
} {
  const message = e.kind === "internal" ? "Something went wrong." : e.message;
  return { status: STATUS[e.kind], body: { error: { kind: e.kind, message } } };
}

/**
 * Cheap checks before the body is read: same-origin only, JSON only, and a
 * declared size under the cap. Returns null when the request may proceed.
 */
export function guardRequest(headers: Headers, url: string): AppError | null {
  const origin = headers.get("origin");
  if (origin && origin !== new URL(url).origin) {
    return { kind: "forbidden", message: "Cross-origin requests are not allowed." };
  }
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return { kind: "forbidden", message: "Cross-origin requests are not allowed." };
  }
  if (!headers.get("content-type")?.startsWith("application/json")) {
    return { kind: "validation", message: "Send JSON." };
  }
  const declared = Number(headers.get("content-length") ?? "0");
  if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
    return { kind: "validation", message: "Too large." };
  }
  return null;
}

/** Reads at most MAX_BODY_BYTES, whatever Content-Length claimed. */
export async function readCapped(body: ReadableStream<Uint8Array> | null): Promise<string | null> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
