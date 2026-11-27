import { describe, expect, it } from "vitest";
import {
  clientIp,
  clientKey,
  createLimiter,
  memoryStore,
  type CounterStore,
} from "@/lib/ratelimit";

const limits = { perMinute: 2, perDay: 3, dailyBudget: 2 };

function clockAt(start: number) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

const broken: CounterStore = { incr: () => Promise.reject(new Error("down")) };

describe("createLimiter", () => {
  it("allows up to the per-minute limit, then asks to wait for the next minute", async () => {
    const clock = clockAt(Date.UTC(2026, 10, 27, 9, 0, 30));
    const limiter = createLimiter(memoryStore(clock.now), clock.now, limits);
    expect(await limiter.check("a")).toEqual({ allowed: true });
    expect(await limiter.check("a")).toEqual({ allowed: true });
    expect(await limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 30 });
    expect(await limiter.check("b")).toEqual({ allowed: true });
  });

  it("enforces the daily cap across minutes", async () => {
    const clock = clockAt(Date.UTC(2026, 10, 27, 23, 0, 0));
    const limiter = createLimiter(memoryStore(clock.now), clock.now, limits);
    for (let i = 0; i < 3; i++) {
      expect((await limiter.check("a")).allowed).toBe(true);
      clock.advance(60_000);
    }
    expect(await limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 3420 });
    clock.advance(3600_000);
    expect((await limiter.check("a")).allowed).toBe(true);
  });

  it("spends the global budget and resets it the next UTC day", async () => {
    const clock = clockAt(Date.UTC(2026, 10, 27, 12));
    const limiter = createLimiter(memoryStore(clock.now), clock.now, limits);
    expect(await limiter.takeBudget()).toBe(true);
    expect(await limiter.takeBudget()).toBe(true);
    expect(await limiter.takeBudget()).toBe(false);
    clock.advance(86_400_000);
    expect(await limiter.takeBudget()).toBe(true);
  });

  it("lets requests through but closes the budget when the store is down", async () => {
    const limiter = createLimiter(broken, () => 0, limits);
    expect(await limiter.check("a")).toEqual({ allowed: true });
    expect(await limiter.takeBudget()).toBe(false);
  });
});

describe("memoryStore", () => {
  it("expires keys and stays within its key cap", async () => {
    const clock = clockAt(0);
    const store = memoryStore(clock.now, 2);
    expect(await store.incr("x", 1000)).toBe(1);
    expect(await store.incr("x", 1000)).toBe(2);
    clock.advance(1000);
    expect(await store.incr("x", 1000)).toBe(1);
    await store.incr("y", 1000);
    await store.incr("z", 1000);
    // "x" was the oldest live key and got dropped to make room.
    expect(await store.incr("x", 1000)).toBe(1);
  });
});

describe("client identity", () => {
  it("prefers x-real-ip, then the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe(
      "198.51.100.1",
    );
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("hashes the address with a salt and never returns it raw", async () => {
    const a = await clientKey("203.0.113.9", "s1");
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toContain("203");
    expect(await clientKey("203.0.113.9", "s1")).toBe(a);
    expect(await clientKey("203.0.113.9", "s2")).not.toBe(a);
  });
});
