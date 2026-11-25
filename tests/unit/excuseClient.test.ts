import { afterEach, describe, expect, it, vi } from "vitest";
import { offlineExcuses, requestExcuses } from "@/components/excuseClient";
import type { FormInput } from "@/lib/form";

const input: FormInput = {
  reason: "standup",
  mode: "late",
  minutesLate: 5,
  localTime: "2026-11-25T08:00",
  localHour: 8,
  weekday: 3,
  audience: "boss",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offlineExcuses", () => {
  it("gives three template slips with estimated traffic", () => {
    const r = offlineExcuses(input, 1);
    expect(r.set.source).toBe("templates");
    expect(r.set.excuses).toHaveLength(3);
    expect(r.used.traffic?.quality).toBe("estimated");
  });

  it("still refuses harmful reasons offline", () => {
    expect(offlineExcuses({ ...input, reason: "rob a bank" }, 1).set.source).toBe("refusal");
  });
});

describe("requestExcuses", () => {
  it("falls back offline on network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    const r = await requestExcuses(input, { kind: "idle" }, [], 1);
    expect(r.set.source).toBe("templates");
  });

  it("falls back offline on a malformed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ set: "<img onerror>" })))),
    );
    const r = await requestExcuses(input, { kind: "idle" }, [], 1);
    expect(r.set.source).toBe("templates");
  });

  it("sends a city, not coordinates, when typed", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("{}", { status: 500 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await requestExcuses(input, { kind: "manual", city: "Tunis" }, [], 1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { place: unknown };
    expect(body.place).toEqual({ kind: "city", city: "Tunis" });
  });
});
