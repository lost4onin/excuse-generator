/**
 * Fixed-window rate limits and a global daily budget. The store is a port:
 * an in-memory adapter (best effort, per server instance) and an Upstash
 * REST adapter (shared). The clock is injected.
 */

export interface CounterStore {
  /** Adds one to `key` and returns the new count; the key expires after `ttlMs`. */
  incr(key: string, ttlMs: number): Promise<number>;
}

export interface Limits {
  perMinute: number;
  perDay: number;
  /** Global LLM calls per UTC day, shared by every visitor. */
  dailyBudget: number;
}

export const DEFAULT_LIMITS: Limits = { perMinute: 6, perDay: 60, dailyBudget: 800 };

const MINUTE = 60_000;
const DAY = 86_400_000;

export type Verdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface Limiter {
  /** Per-client check, counted on every request. `client` is already anonymised. */
  check(client: string): Promise<Verdict>;
  /** Takes one unit of the global LLM budget. False once the day is spent. */
  takeBudget(): Promise<boolean>;
}

export function createLimiter(store: CounterStore, now: () => number, limits: Limits): Limiter {
  return {
    async check(client) {
      const t = now();
      const minute = Math.floor(t / MINUTE);
      const day = Math.floor(t / DAY);
      try {
        const [m, d] = await Promise.all([
          store.incr(`rl:m:${client}:${String(minute)}`, MINUTE),
          store.incr(`rl:d:${client}:${String(day)}`, DAY),
        ]);
        if (d > limits.perDay) {
          return { allowed: false, retryAfterSeconds: Math.ceil(((day + 1) * DAY - t) / 1000) };
        }
        if (m > limits.perMinute) {
          return {
            allowed: false,
            retryAfterSeconds: Math.ceil(((minute + 1) * MINUTE - t) / 1000),
          };
        }
        return { allowed: true };
      } catch {
        // Store down: let the request through; the budget below fails closed.
        return { allowed: true };
      }
    },
    async takeBudget() {
      const day = Math.floor(now() / DAY);
      try {
        return (await store.incr(`budget:llm:${String(day)}`, DAY)) <= limits.dailyBudget;
      } catch {
        return false;
      }
    },
  };
}

/** Best-effort store: per instance, lost on cold start. Prunes expired keys. */
export function memoryStore(now: () => number, maxKeys = 10_000): CounterStore {
  const counts = new Map<string, { n: number; expires: number }>();
  return {
    incr(key, ttlMs) {
      const t = now();
      if (counts.size >= maxKeys) {
        for (const [k, v] of counts) if (v.expires <= t) counts.delete(k);
        // Still full of live keys: drop the oldest rather than grow without bound.
        if (counts.size >= maxKeys) {
          const oldest = counts.keys().next().value;
          if (oldest !== undefined) counts.delete(oldest);
        }
      }
      const cur = counts.get(key);
      const entry = cur && cur.expires > t ? cur : { n: 0, expires: t + ttlMs };
      entry.n += 1;
      counts.set(key, entry);
      return Promise.resolve(entry.n);
    },
  };
}

/**
 * Anonymises a client address before it becomes a storage key: a salted
 * SHA-256, truncated. The raw IP is never stored.
 */
export async function clientKey(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The client address as the platform proxy reports it. */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : "unknown";
}
