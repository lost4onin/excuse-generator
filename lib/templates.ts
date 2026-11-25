import type {
  Audience,
  ContextTag,
  DataQuality,
  Excuse,
  ExcuseContext,
  ExcuseSet,
  NearbyEvent,
  Tier,
} from "@/lib/domain";
import { TIERS } from "@/lib/domain";
import { overlapping } from "@/lib/events";
import { pick, type Rng } from "@/lib/random";

/** Facts a template may quote. Only present when relevant to the time. */
interface Facts {
  reason: string;
  late: boolean;
  minutes: number;
  sky?: string;
  traffic?: string;
  event?: NearbyEvent;
}

interface Template {
  tier: Tier;
  tag: ContextTag;
  /** Who it is fit for; omitted means everyone. */
  audiences?: readonly Audience[];
  /** Restrict to late or absent; omitted means both. */
  late?: boolean;
  render: (f: Facts) => string;
}

const late = (f: Facts) => `${String(f.minutes)} minutes late`;
const formal: readonly Audience[] = ["boss", "teacher"];
const close: readonly Audience[] = ["friend", "family", "date"];

/* Small on purpose: this is the fallback, not the main act. */
const TEMPLATES: readonly Template[] = [
  // Safe: short, boring, hard to question.
  {
    tier: "safe",
    tag: "none",
    late: true,
    render: (f) => `Running ${late(f)} for the ${f.reason}. Sorry, on my way.`,
  },
  {
    tier: "safe",
    tag: "none",
    late: false,
    audiences: formal,
    render: (f) => `I can't make the ${f.reason} today. I'll catch up on what I missed.`,
  },
  {
    tier: "safe",
    tag: "none",
    late: false,
    audiences: close,
    render: (f) => `I can't make the ${f.reason} today, sorry. Rain check?`,
  },
  {
    tier: "safe",
    tag: "traffic",
    late: true,
    render: (f) => `Stuck in ${f.traffic ?? "traffic"}. About ${String(f.minutes)} minutes behind.`,
  },
  {
    tier: "safe",
    tag: "weather",
    late: true,
    render: (f) =>
      `The ${f.sky ?? "weather"} slowed everything down. ${String(f.minutes)} minutes out.`,
  },

  // Creative: a little story with exactly one context detail.
  {
    tier: "creative",
    tag: "weather",
    late: true,
    render: (f) =>
      `Left on time, then the ${f.sky ?? "weather"} turned my route into a queue. I'll be ${late(f)} to the ${f.reason}, slightly damp but present.`,
  },
  {
    tier: "creative",
    tag: "weather",
    late: false,
    render: (f) =>
      `The forecast says ${f.sky ?? "bad weather"} right when the ${f.reason} starts, and my plan B was an umbrella with a hole. I'll have to skip this one.`,
  },
  {
    tier: "creative",
    tag: "traffic",
    late: true,
    render: (f) =>
      `I hit ${f.traffic ?? "heavy traffic"} and every shortcut had the same idea. Expect me ${late(f)} for the ${f.reason}.`,
  },
  {
    tier: "creative",
    tag: "event",
    late: true,
    render: (f) =>
      `${f.event?.name ?? "An event"} is on near ${f.event?.venue ?? "my route"} and the whole area is gridlocked. ${String(f.minutes)} minutes late for the ${f.reason}, sorry.`,
  },
  {
    tier: "creative",
    tag: "event",
    late: false,
    render: (f) =>
      `${f.event?.name ?? "A big event"} has closed half the streets around ${f.event?.venue ?? "here"}, so getting to the ${f.reason} today is not realistic.`,
  },
  {
    tier: "creative",
    tag: "none",
    late: true,
    render: (f) =>
      `My bus decided today was a good day to stop at every single stop. ${late(f)} for the ${f.reason}.`,
  },
  {
    tier: "creative",
    tag: "none",
    late: false,
    audiences: formal,
    render: (f) =>
      `A plumber gave me a "window" that covers the whole ${f.reason}. I'm stuck waiting at home.`,
  },
  {
    tier: "creative",
    tag: "none",
    late: false,
    audiences: close,
    render: (f) =>
      `My phone and my calendar disagreed about today and the calendar lost. I can't make the ${f.reason}, can we move it?`,
  },

  // Bold: risky, memorable, physically possible, never about health or the law.
  {
    tier: "bold",
    tag: "none",
    late: true,
    render: (f) =>
      `I locked my keys inside, then locked myself out of the spare key box. ${late(f)} for the ${f.reason}, with a new respect for locksmiths.`,
  },
  {
    tier: "bold",
    tag: "none",
    late: true,
    audiences: close,
    render: (f) =>
      `A pigeon walked into the bus and refused to leave. We all waited. ${late(f)} to the ${f.reason}.`,
  },
  {
    tier: "bold",
    tag: "none",
    late: false,
    render: (f) =>
      `I agreed to help a neighbour move a piano "for ten minutes". It has been longer. I have to miss the ${f.reason}.`,
  },
  {
    tier: "bold",
    tag: "weather",
    late: true,
    render: (f) =>
      `The ${f.sky ?? "weather"} flipped my umbrella inside out and I chased it down two streets. ${late(f)} for the ${f.reason}, umbrella recovered.`,
  },
  {
    tier: "bold",
    tag: "traffic",
    late: true,
    render: (f) =>
      `I tried to beat the ${f.traffic ?? "traffic"} by walking and discovered how big this city is. ${late(f)} for the ${f.reason}.`,
  },
  {
    tier: "bold",
    tag: "event",
    render: (f) =>
      `I got swept into the crowd for ${f.event?.name ?? "an event"} near ${f.event?.venue ?? "my route"} and only escaped at the far end. ${f.late ? `${late(f)} for the ${f.reason}.` : `I won't make the ${f.reason}.`}`,
  },
];

/** Which tags have real backing in this context, and the facts they may use. */
export function relevantFacts(ctx: ExcuseContext): { facts: Facts; tags: Set<ContextTag> } {
  const tags = new Set<ContextTag>(["none"]);
  const facts: Facts = {
    reason: ctx.reason,
    late: ctx.mode === "late",
    minutes: ctx.minutesLate ?? 10,
  };
  if (ctx.weather?.isRaining) {
    tags.add("weather");
    facts.sky = ctx.weather.description;
  }
  if (ctx.traffic?.rushHour) {
    tags.add("traffic");
    facts.traffic = ctx.traffic.reason.split(",")[0] ?? "rush hour";
  }
  // Demo events are made up: they may be shown, flagged, but never told as fact.
  const nearby = ctx.events?.quality === "live" ? overlapping(ctx.events.events, ctx.time) : [];
  if (nearby[0]) {
    tags.add("event");
    facts.event = nearby[0];
  }
  return { facts, tags };
}

/** Which data stamps an excuse needs, from the context it leans on. */
export function flagsFor(tag: ContextTag): DataQuality[] {
  if (tag === "traffic") return ["estimated"];
  return [];
}

export function eligible(tier: Tier, ctx: ExcuseContext, tags: Set<ContextTag>): Template[] {
  const isLate = ctx.mode === "late";
  return TEMPLATES.filter(
    (t) =>
      t.tier === tier &&
      tags.has(t.tag) &&
      (t.late === undefined || t.late === isLate) &&
      (t.audiences === undefined || t.audiences.includes(ctx.audience)),
  );
}

/**
 * Always returns three excuses. Creative prefers a template that uses a real
 * context detail; if there is none, it tells a context-free story instead.
 */
export function templateExcuses(ctx: ExcuseContext, rng: Rng): ExcuseSet {
  const { facts, tags } = relevantFacts(ctx);
  const make = (tier: Tier): Excuse => {
    const all = eligible(tier, ctx, tags);
    const withContext = all.filter((t) => t.tag !== "none");
    const pool = tier === "creative" && withContext.length > 0 ? withContext : all;
    const t = pick(rng, pool) ?? pick(rng, all);
    if (!t) {
      return { tier, tag: "none", flags: [], text: `Sorry, I can't make the ${ctx.reason}.` };
    }
    return { tier, tag: t.tag, flags: flagsFor(t.tag), text: t.render(facts) };
  };
  const [a, b, c] = TIERS;
  return { source: "templates", excuses: [make(a), make(b), make(c)] };
}
