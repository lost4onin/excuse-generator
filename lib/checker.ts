import { z } from "zod";
import type { ContextTag, DataQuality, Excuse, ExcuseContext, Tier } from "@/lib/domain";
import { TIERS } from "@/lib/domain";
import { err, ok, type Result } from "@/lib/result";
import { relevantFacts } from "@/lib/templates";

export const SAFE_MAX_WORDS = 22;

const outputSchema = z.object({
  excuses: z
    .array(z.object({ tier: z.enum(TIERS), text: z.string().trim().min(5).max(400) }))
    .length(3),
});

/** Topics that are off limits in any tier. */
const FORBIDDEN: readonly RegExp[] = [
  /\b(ill|illness|sick|fever|flu|covid|virus|migraine|vomit\w*|food poisoning)\b/i,
  /\b(hospital|doctor|clinic|surgery|ambulance|emergency|a&e|er visit)\b/i,
  /\b(died|dead|death|dying|funeral|passed away|grave)\b/i,
  /\b(accident|crash(ed)?|injur\w*|broke my (arm|leg)|bleeding)\b/i,
  /\b(police|arrest\w*|court|jail|prison|lawyer|crime|criminal|stolen|robbed|ticketed)\b/i,
];

const RAIN_WORDS = /\b(rain\w*|storm\w*|downpour|drizzl\w*|umbrella|soaked|flood\w*|wet)\b/i;
const TRAFFIC_WORDS = /\b(traffic|gridlock\w*|jam(med)?|rush hour|congest\w*|queue of cars)\b/i;

function tagsIn(text: string, ctx: ExcuseContext, eventName?: string): Set<ContextTag> {
  const tags = new Set<ContextTag>();
  if (ctx.weather && RAIN_WORDS.test(text)) tags.add("weather");
  if (TRAFFIC_WORDS.test(text)) tags.add("traffic");
  if (eventName && text.toLowerCase().includes(eventName.toLowerCase())) tags.add("event");
  return tags;
}

function flagsFor(tag: ContextTag, ctx: ExcuseContext): DataQuality[] {
  if (tag === "traffic") return ["estimated"];
  if (tag === "event" && ctx.events?.quality === "demo") return ["demo"];
  return [];
}

/** Strips a Markdown code fence if the model wrapped its JSON in one. */
function unwrap(raw: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw.trim());
  return fenced?.[1] ?? raw.trim();
}

export type CheckFailure = "invalid_json" | "schema" | "forbidden" | "contradiction" | "tier_rule";

/**
 * Validates the model's reply and re-checks the content rules in code.
 * Returns the three excuses in tier order, tagged and flagged, or a reason it
 * failed (the caller falls back to templates).
 */
export function checkOutput(
  raw: string,
  ctx: ExcuseContext,
): Result<[Excuse, Excuse, Excuse]> & {
  failure?: CheckFailure;
} {
  const fail = (failure: CheckFailure, message: string) => ({
    ...err<[Excuse, Excuse, Excuse]>("upstream", message),
    failure,
  });

  let data: unknown;
  try {
    data = JSON.parse(unwrap(raw));
  } catch {
    return fail("invalid_json", "Model reply was not JSON");
  }
  const parsed = outputSchema.safeParse(data);
  if (!parsed.success) return fail("schema", "Model reply had the wrong shape");

  const byTier = new Map<Tier, string>();
  for (const e of parsed.data.excuses) byTier.set(e.tier, e.text.replace(/\s+/g, " "));
  if (byTier.size !== 3) return fail("schema", "Model reply repeated a tier");

  const { facts, tags: available } = relevantFacts(ctx);
  const contextCount = [...available].filter((t) => t !== "none").length;

  const out: Excuse[] = [];
  for (const tier of TIERS) {
    const text = byTier.get(tier) ?? "";
    if (FORBIDDEN.some((re) => re.test(text)))
      return fail("forbidden", `${tier} broke a content rule`);
    if (ctx.weather && !ctx.weather.isRaining && RAIN_WORDS.test(text)) {
      return fail("contradiction", `${tier} invented bad weather`);
    }
    if (ctx.traffic?.level === "light" && TRAFFIC_WORDS.test(text)) {
      return fail("contradiction", `${tier} invented a traffic jam`);
    }
    const used = tagsIn(text, ctx, facts.event?.name);
    if (tier === "safe" && text.split(" ").length > SAFE_MAX_WORDS) {
      return fail("tier_rule", "safe excuse is too long");
    }
    if (tier === "creative" && contextCount > 0 && used.size !== 1) {
      return fail("tier_rule", "creative excuse must use exactly one context detail");
    }
    const tag: ContextTag = [...used][0] ?? "none";
    out.push({ tier, text, tag, flags: flagsFor(tag, ctx) });
  }
  const [a, b, c] = out as [Excuse, Excuse, Excuse];
  return ok([a, b, c]);
}
