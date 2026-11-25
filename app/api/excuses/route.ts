import { errorBody, MAX_BODY_BYTES, parseRequest, toResponse } from "@/lib/api";
import { demoEvents } from "@/lib/events";
import { seeded } from "@/lib/random";
import type { AppError } from "@/lib/result";
import { buildContext, generate } from "@/lib/service";
import { getConfig } from "@/lib/server/env";
import { ticketmaster } from "@/lib/ticketmaster";
import { openMeteo } from "@/lib/weather";

export const dynamic = "force-dynamic";

// Composition root for the server. Module scope only holds keyless adapters.
const weather = openMeteo(fetch, { now: () => Date.now() });

function fail(e: AppError): Response {
  const { status, body } = errorBody(e);
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return fail({ kind: "forbidden", message: "Cross-origin requests are not allowed." });
  }
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return fail({ kind: "validation", message: "Send JSON." });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return fail({ kind: "validation", message: "Too large." });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail({ kind: "validation", message: "Malformed request" });
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return fail(parsed.error);

  try {
    const config = getConfig();
    const events = config.ticketmasterApiKey
      ? ticketmaster(fetch, config.ticketmasterApiKey)
      : demoEvents;
    const { input, place, avoid, seed } = parsed.value;
    const ctx = await buildContext(input, place, { weather, geocoder: weather, events });
    const rng = seeded(seed ?? Math.floor(Math.random() * 2 ** 31));
    const set = await generate(ctx, avoid, { writer: null, rng });
    return Response.json(toResponse(set, ctx), { headers: { "cache-control": "no-store" } });
  } catch {
    // Deliberately not logging the request: it holds the reason and place.
    return fail({ kind: "internal", message: "internal" });
  }
}
