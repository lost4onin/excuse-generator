import { errorBody, guardRequest, parseRequest, readCapped, toResponse } from "@/lib/api";
import { demoEvents } from "@/lib/events";
import { seeded } from "@/lib/random";
import { clientIp, clientKey, createLimiter, DEFAULT_LIMITS, memoryStore } from "@/lib/ratelimit";
import type { AppError } from "@/lib/result";
import { buildContext, generate } from "@/lib/service";
import { getConfig } from "@/lib/server/env";
import { ticketmaster } from "@/lib/ticketmaster";
import { upstashStore } from "@/lib/upstash";
import { openMeteo } from "@/lib/weather";

export const dynamic = "force-dynamic";

// Composition root for the server. Module scope only holds keyless adapters.
const now = () => Date.now();
const weather = openMeteo(fetch, { now });
// Fallback counters when no shared store is configured: per instance, best effort.
const localCounters = memoryStore(now);
const localSalt = crypto.randomUUID();

function fail(e: AppError, headers: Record<string, string> = {}): Response {
  const { status, body } = errorBody(e);
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export async function POST(req: Request): Promise<Response> {
  const blocked = guardRequest(req.headers, req.url);
  if (blocked) return fail(blocked);

  let config;
  try {
    config = getConfig();
  } catch {
    return fail({ kind: "internal", message: "internal" });
  }
  const store = config.upstash ? upstashStore(fetch, config.upstash) : localCounters;
  const limiter = createLimiter(store, now, DEFAULT_LIMITS);
  const client = await clientKey(clientIp(req.headers), config.upstash?.token ?? localSalt);
  const verdict = await limiter.check(client);
  if (!verdict.allowed) {
    return fail(
      { kind: "rate_limited", message: "Too many slips. Try again shortly." },
      { "retry-after": String(verdict.retryAfterSeconds) },
    );
  }

  const raw = await readCapped(req.body);
  if (raw === null) return fail({ kind: "validation", message: "Too large." });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail({ kind: "validation", message: "Malformed request" });
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return fail(parsed.error);

  try {
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
