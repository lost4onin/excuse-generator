import { describe, expect, it } from "vitest";
import type { Fetcher } from "@/lib/http";
import { upstashStore } from "@/lib/upstash";

const creds = { url: "https://eu1-example.upstash.io/", token: "t0ken" };

function fakeFetch(respond: () => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: Fetcher = (url, init) => {
    calls.push({ url, ...(init ? { init } : {}) });
    return Promise.resolve(respond());
  };
  return { fetcher, calls };
}

describe("upstashStore", () => {
  it("sets the expiry once and increments in one pipeline", async () => {
    const { fetcher, calls } = fakeFetch(() => Response.json([{ result: "OK" }, { result: 3 }]));
    expect(await upstashStore(fetcher, creds).incr("rl:m:abc:1", 60000)).toBe(3);
    expect(calls[0]?.url).toBe("https://eu1-example.upstash.io/pipeline");
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual([
      ["SET", "rl:m:abc:1", "0", "PX", "60000", "NX"],
      ["INCR", "rl:m:abc:1"],
    ]);
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer t0ken");
  });

  it("throws on HTTP errors and odd shapes, without echoing the token", async () => {
    const down = upstashStore(fakeFetch(() => new Response("no", { status: 503 })).fetcher, creds);
    await expect(down.incr("k", 1)).rejects.toThrow(/HTTP 503/);
    const odd = upstashStore(fakeFetch(() => Response.json({ result: 1 })).fetcher, creds);
    const e: unknown = await odd.incr("k", 1).catch((x: unknown) => x);
    expect(String(e)).toMatch(/unexpected shape/);
    expect(String(e)).not.toContain("t0ken");
  });
});
