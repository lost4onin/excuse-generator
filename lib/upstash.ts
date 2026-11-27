import { z } from "zod";
import type { Fetcher } from "@/lib/http";
import type { CounterStore } from "@/lib/ratelimit";

const pipelineSchema = z.tuple([
  z.object({ result: z.unknown() }),
  z.object({ result: z.number().int() }),
]);

/**
 * Shared counter store over the Upstash Redis REST API. One pipeline per
 * increment: create the key with its expiry if missing, then INCR. Throws on
 * any failure; the limiter decides what that means.
 */
export function upstashStore(
  fetcher: Fetcher,
  { url, token }: { url: string; token: string },
  timeoutMs = 1500,
): CounterStore {
  const endpoint = `${url.replace(/\/+$/, "")}/pipeline`;
  return {
    async incr(key, ttlMs) {
      const res = await fetcher(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify([
          ["SET", key, "0", "PX", String(ttlMs), "NX"],
          ["INCR", key],
        ]),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Counter store failed (HTTP ${String(res.status)})`);
      const parsed = pipelineSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("Counter store returned an unexpected shape");
      return parsed.data[1].result;
    },
  };
}
