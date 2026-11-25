import { describe, expect, it } from "vitest";
import { AUDIENCES, isAudience, TIERS } from "@/lib/domain";
import { err, ok } from "@/lib/result";

describe("domain", () => {
  it("has exactly three tiers in display order", () => {
    expect(TIERS).toEqual(["safe", "creative", "bold"]);
  });

  it("guards audiences", () => {
    for (const a of AUDIENCES) expect(isAudience(a)).toBe(true);
    expect(isAudience("landlord")).toBe(false);
    expect(isAudience(3)).toBe(false);
  });

  it("builds results", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err("validation", "nope")).toEqual({
      ok: false,
      error: { kind: "validation", message: "nope" },
    });
  });
});
