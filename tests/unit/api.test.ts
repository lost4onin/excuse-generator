import { describe, expect, it } from "vitest";
import { errorBody, guardRequest, parseRequest, readCapped, toResponse } from "@/lib/api";
import type { ExcuseContext } from "@/lib/domain";
import { seeded } from "@/lib/random";
import { templateExcuses } from "@/lib/templates";

const form = {
  reason: "standup",
  mode: "late",
  minutesLate: "10",
  localTime: "2026-11-25T09:00",
  audience: "boss",
};

describe("parseRequest", () => {
  it("accepts a well-formed request and coarsens coordinates", () => {
    const r = parseRequest({
      form,
      place: { kind: "coords", latitude: 36.80649, longitude: 10.18153 },
    });
    expect(r.ok && r.value.place).toEqual({
      kind: "coords",
      coords: { latitude: 36.81, longitude: 10.18 },
    });
    expect(r.ok && r.value.avoid).toEqual([]);
  });

  it("rejects bad shapes, bad forms and bad cities", () => {
    expect(parseRequest(null).ok).toBe(false);
    expect(parseRequest({ form, place: { kind: "teleport" } }).ok).toBe(false);
    expect(parseRequest({ form: { ...form, audience: "cat" }, place: { kind: "none" } }).ok).toBe(
      false,
    );
    const city = parseRequest({ form, place: { kind: "city", city: "http://169.254.169.254" } });
    expect(!city.ok && city.error.kind).toBe("validation");
  });

  it("caps the avoid list", () => {
    const avoid = Array.from({ length: 11 }, () => "x");
    expect(parseRequest({ form, place: { kind: "none" }, avoid }).ok).toBe(false);
  });
});

describe("toResponse", () => {
  it("summarises what was used and keeps flags", () => {
    const ctx: ExcuseContext = {
      reason: "standup",
      mode: "late",
      minutesLate: 10,
      time: "2026-11-25T09:00",
      localHour: 9,
      weekday: 3,
      audience: "boss",
      place: { city: "Tunis", latitude: 36.8, longitude: 10.2 },
      traffic: { quality: "estimated", level: "heavy", rushHour: true, reason: "rush" },
      events: { quality: "demo", events: [{ name: "Fair", venue: "v", startsAt: "x" }] },
    };
    const res = toResponse(templateExcuses(ctx, seeded(1)), ctx);
    expect(res.used).toEqual({
      place: "Tunis",
      traffic: { level: "heavy", quality: "estimated" },
      events: { quality: "demo", names: [{ name: "Fair" }] },
    });
    expect(JSON.stringify(res)).not.toContain("36.8");
  });
});

describe("errorBody", () => {
  it("maps kinds to statuses and hides internals", () => {
    expect(errorBody({ kind: "validation", message: "bad" }).status).toBe(400);
    expect(errorBody({ kind: "rate_limited", message: "slow down" }).status).toBe(429);
    expect(errorBody({ kind: "internal", message: "stack trace here" })).toEqual({
      status: 500,
      body: { error: { kind: "internal", message: "Something went wrong." } },
    });
  });
});

describe("guardRequest", () => {
  const url = "https://excuses.example/api/excuses";
  const h = (init: Record<string, string>) =>
    new Headers({ "content-type": "application/json", ...init });

  it("lets same-origin JSON through", () => {
    expect(guardRequest(h({ origin: "https://excuses.example" }), url)).toBeNull();
    expect(guardRequest(h({ "sec-fetch-site": "same-origin" }), url)).toBeNull();
  });

  it("blocks other origins and cross-site fetches", () => {
    expect(guardRequest(h({ origin: "https://evil.example" }), url)?.kind).toBe("forbidden");
    expect(guardRequest(h({ "sec-fetch-site": "cross-site" }), url)?.kind).toBe("forbidden");
  });

  it("wants JSON and a small declared body", () => {
    expect(guardRequest(new Headers({ "content-type": "text/plain" }), url)?.kind).toBe(
      "validation",
    );
    expect(guardRequest(h({ "content-length": "999999" }), url)?.message).toBe("Too large.");
  });
});

describe("readCapped", () => {
  const stream = (text: string) => new Response(text).body;

  it("reads small bodies", async () => {
    expect(await readCapped(stream('{"a":1}'))).toBe('{"a":1}');
  });

  it("counts bytes, not characters", async () => {
    expect(await readCapped(stream("é".repeat(2100)))).toBeNull();
    expect(await readCapped(stream("e".repeat(2100)))).not.toBeNull();
  });
});
