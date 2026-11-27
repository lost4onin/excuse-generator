import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig } from "@/lib/config";

describe("parseConfig", () => {
  it("runs with no optional services", () => {
    expect(parseConfig({})).toEqual({ llm: null, ticketmasterApiKey: null, upstash: null });
  });

  it("treats blank values as unset", () => {
    expect(parseConfig({ LLM_API_KEY: "  ", TICKETMASTER_API_KEY: "" })).toEqual({
      llm: null,
      ticketmasterApiKey: null,
      upstash: null,
    });
  });

  it("reads a complete LLM block", () => {
    const cfg = parseConfig({
      LLM_BASE_URL: "https://llm.example.com/v1",
      LLM_MODEL: "some-model",
      LLM_API_KEY: "k",
    });
    expect(cfg.llm).toEqual({
      baseUrl: "https://llm.example.com/v1",
      model: "some-model",
      apiKey: "k",
    });
  });

  it("refuses a half-configured LLM", () => {
    expect(() => parseConfig({ LLM_API_KEY: "k" })).toThrow(ConfigError);
  });

  it("refuses a plain-http base URL", () => {
    expect(() =>
      parseConfig({ LLM_BASE_URL: "http://llm.example.com", LLM_MODEL: "m", LLM_API_KEY: "k" }),
    ).toThrow(/LLM_BASE_URL/);
  });

  it("never echoes secret values in errors", () => {
    const secret = "x".repeat(600);
    try {
      parseConfig({ LLM_BASE_URL: "https://a.example", LLM_MODEL: "m", LLM_API_KEY: secret });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain(secret);
    }
  });

  it("reads the Upstash pair under either name, and only from upstash.io over https", () => {
    const url = "https://eu1-example.upstash.io";
    expect(parseConfig({ KV_REST_API_URL: url, KV_REST_API_TOKEN: "t" }).upstash).toEqual({
      url,
      token: "t",
    });
    expect(
      parseConfig({ UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: "t" }).upstash,
    ).toEqual({ url, token: "t" });
    expect(() =>
      parseConfig({ KV_REST_API_URL: "https://evil.example", KV_REST_API_TOKEN: "t" }),
    ).toThrow(/KV_REST_API_URL/);
    expect(() => parseConfig({ KV_REST_API_URL: url })).toThrow(ConfigError);
  });
});
