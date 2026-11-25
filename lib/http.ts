import { err, ok, type Result } from "@/lib/result";

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface GetJsonOptions {
  timeoutMs: number;
  /** Extra attempts after the first, only on network errors and 5xx. */
  retries: number;
  headers?: Record<string, string>;
}

/**
 * GET a JSON document with a hard timeout and bounded retries. Never throws;
 * failures come back as "upstream" errors without response bodies or URLs
 * (URLs may carry API keys).
 */
export async function getJson(
  fetcher: Fetcher,
  url: string,
  { timeoutMs, retries, headers }: GetJsonOptions,
): Promise<Result<unknown>> {
  let lastStatus = "network error";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetcher(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json", ...headers },
        cache: "no-store",
      });
      if (res.ok) return ok(await res.json());
      lastStatus = `HTTP ${String(res.status)}`;
      if (res.status < 500) break;
    } catch (e) {
      lastStatus = e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network error";
    }
  }
  return err("upstream", `Upstream request failed (${lastStatus})`);
}
