import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig } from "@/lib/config";

describe("parseConfig", () => {
  it("runs with no optional services", () => {
    expect(parseConfig({})).toEqual({ llm: null, ticketmasterApiKey: null });
  });

  it("treats blank values as unset", () => {
    expect(parseConfig({ LLM_API_KEY: "  ", TICKETMASTER_API_KEY: "" })).toEqual({
      llm: null,
      ticketmasterApiKey: null,
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
});
