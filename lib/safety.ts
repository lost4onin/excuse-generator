import type { Excuse, ExcuseSet } from "@/lib/domain";

/**
 * Coarse screen for reasons that are about harm or crime. It only has to catch
 * the obvious; the reason is never executed, only quoted back.
 */
const HARMFUL = [
  /\b(kill|murder|stab|shoot|strangle|poison)\w*/i,
  /\b(assault|abuse|kidnap|hostage)\w*/i,
  /\b(rob|robbery|steal|stole|burgl|shoplift)\w*/i,
  /\b(bomb|explosive|weapon|gun)s?\b/i,
  /\b(hit[- ]and[- ]run|drunk driving|dui)\b/i,
  /\b(alibi|cover[- ]?up|hide (the|a) body|evade (the )?police)\b/i,
  /\b(self[- ]?harm|suicide)\b/i,
];

export function isHarmfulReason(reason: string): boolean {
  return HARMFUL.some((re) => re.test(reason));
}

const refusal = (tier: Excuse["tier"], text: string): Excuse => ({
  tier,
  text,
  tag: "none",
  flags: [],
});

/** Returned instead of excuses when the reason is about harm or crime. */
export function refusalSet(): ExcuseSet {
  return {
    source: "refusal",
    excuses: [
      refusal(
        "safe",
        "Not that kind of excuse. This desk only covers missed meetings and late dinners.",
      ),
      refusal(
        "creative",
        "If someone could get hurt, the honest call is the right one. Talk to a real person.",
      ),
      refusal("bold", "Try again with something you are merely late for."),
    ],
  };
}
