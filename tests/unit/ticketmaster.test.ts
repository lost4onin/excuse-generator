import { describe, expect, it, vi } from "vitest";
import type { Fetcher } from "@/lib/http";
import { parseEvents, ticketmaster } from "@/lib/ticketmaster";
import fixture from "../fixtures/ticketmaster-events.json";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("parseEvents", () => {
  it("maps valid events and drops broken ones", () => {
    expect(parseEvents(fixture)).toEqual([
      {
        name: "Derby Night",
        venue: "Stade Olympique",
        startsAt: "2026-11-25T19:30",
        url: "https://www.ticketmaster.example/event/1",
      },
      { name: "Jazz Brunch", venue: "a venue nearby", startsAt: "2026-11-26T12:00" },
    ]);
  });

  it("treats an empty page as no events", () => {
    expect(parseEvents({ page: { totalElements: 0 } })).toEqual([]);
  });

  it("rejects a non-object", () => {
    expect(parseEvents("nope")).toBeNull();
  });
});

describe("ticketmaster adapter", () => {
  it("queries by coordinates within a three-day window", async () => {
    const fetcher = vi.fn<Fetcher>(() => json(fixture));
    const r = await ticketmaster(fetcher, "test-key").near({
      coords: { latitude: 36.8, longitude: 10.18 },
      localTime: "2026-11-25T18:00",
    });
    const url = new URL(fetcher.mock.calls[0]?.[0] ?? "");
    expect(url.host).toBe("app.ticketmaster.com");
    expect(url.searchParams.get("latlong")).toBe("36.8,10.18");
    expect(url.searchParams.get("startDateTime")).toBe("2026-11-24T00:00:00Z");
    expect(url.searchParams.get("endDateTime")).toBe("2026-11-26T23:59:59Z");
    expect(r.ok && r.value.quality).toBe("live");
  });

  it("falls back to the city name", async () => {
    const fetcher = vi.fn<Fetcher>(() => json(fixture));
    await ticketmaster(fetcher, "k").near({ city: "Tunis", localTime: "2026-11-25T18:00" });
    expect(new URL(fetcher.mock.calls[0]?.[0] ?? "").searchParams.get("city")).toBe("Tunis");
  });

  it("never leaks the key in error messages", async () => {
    const fetcher = vi.fn<Fetcher>(() => json({}, 401));
    const r = await ticketmaster(fetcher, "super-secret-key").near({
      city: "Tunis",
      localTime: "2026-11-25T18:00",
    });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("super-secret-key");
  });

  it("needs a place", async () => {
    const fetcher = vi.fn<Fetcher>(() => json(fixture));
    const r = await ticketmaster(fetcher, "k").near({ localTime: "2026-11-25T18:00" });
    expect(!r.ok && r.error.kind).toBe("validation");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
