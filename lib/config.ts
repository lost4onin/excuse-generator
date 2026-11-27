import { z } from "zod";

/** Typed runtime settings. Parsed once at the composition root, never read ad hoc. */
export interface Config {
  llm: { baseUrl: string; model: string; apiKey: string } | null;
  ticketmasterApiKey: string | null;
  /** Shared rate-limit counters (Upstash REST); null means in-memory, per instance. */
  upstash: { url: string; token: string } | null;
}

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// Fixed host family: the counter store URL is config, but never an arbitrary host.
const upstashUrl = z.url({ protocol: /^https$/, hostname: /\.upstash\.io$/ });

const envSchema = z.object({
  LLM_BASE_URL: optionalText.pipe(z.url({ protocol: /^https$/ }).optional()),
  LLM_MODEL: optionalText.pipe(z.string().max(200).optional()),
  LLM_API_KEY: optionalText.pipe(z.string().max(500).optional()),
  TICKETMASTER_API_KEY: optionalText.pipe(z.string().max(200).optional()),
  // Vercel's Upstash integration names them KV_REST_API_*; either spelling works.
  UPSTASH_REDIS_REST_URL: optionalText.pipe(upstashUrl.optional()),
  UPSTASH_REDIS_REST_TOKEN: optionalText.pipe(z.string().max(500).optional()),
  KV_REST_API_URL: optionalText.pipe(upstashUrl.optional()),
  KV_REST_API_TOKEN: optionalText.pipe(z.string().max(500).optional()),
});

export class ConfigError extends Error {
  override name = "ConfigError";
}

/**
 * Validates environment variables. The LLM is optional, but it is all three
 * variables or none: a half-configured provider fails fast. Messages name the
 * variable, never its value.
 */
export function parseConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new ConfigError(`Invalid environment variables: ${names.join(", ")}`);
  }
  const { LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, TICKETMASTER_API_KEY } = parsed.data;
  const upstashUrlValue = parsed.data.UPSTASH_REDIS_REST_URL ?? parsed.data.KV_REST_API_URL;
  const upstashAuth = parsed.data.UPSTASH_REDIS_REST_TOKEN ?? parsed.data.KV_REST_API_TOKEN;
  if ((upstashUrlValue === undefined) !== (upstashAuth === undefined)) {
    throw new ConfigError("The Upstash REST URL and token must be set together");
  }
  const llmParts = [LLM_BASE_URL, LLM_MODEL, LLM_API_KEY];
  const setCount = llmParts.filter((v) => v !== undefined).length;
  if (setCount !== 0 && setCount !== 3) {
    throw new ConfigError("LLM_BASE_URL, LLM_MODEL and LLM_API_KEY must be set together");
  }
  return {
    llm:
      LLM_BASE_URL && LLM_MODEL && LLM_API_KEY
        ? { baseUrl: LLM_BASE_URL, model: LLM_MODEL, apiKey: LLM_API_KEY }
        : null,
    ticketmasterApiKey: TICKETMASTER_API_KEY ?? null,
    upstash: upstashUrlValue && upstashAuth ? { url: upstashUrlValue, token: upstashAuth } : null,
  };
}
