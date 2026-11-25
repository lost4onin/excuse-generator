import { describe, expect, it } from "vitest";
import { coarsen, roundCoord, validateCity } from "@/lib/place";

describe("place", () => {
  it("rounds coordinates to two decimals", () => {
    expect(roundCoord(36.80649)).toBe(36.81);
    expect(coarsen({ latitude: 36.80649, longitude: 10.18153 })).toEqual({
      latitude: 36.81,
      longitude: 10.18,
    });
  });

  it("rejects impossible coordinates", () => {
    expect(coarsen({ latitude: 91, longitude: 0 })).toBeNull();
    expect(coarsen({ latitude: Number.NaN, longitude: 0 })).toBeNull();
  });

  it("accepts real city names, accents included", () => {
    expect(validateCity("  São   Paulo ")).toEqual({ ok: true, city: "São Paulo" });
    expect(validateCity("Ben Arous")).toEqual({ ok: true, city: "Ben Arous" });
    expect(validateCity("L'Aquila").ok).toBe(true);
  });

  it("rejects junk, URLs and overlong input", () => {
    expect(validateCity("x").ok).toBe(false);
    expect(validateCity("https://evil.example/").ok).toBe(false);
    expect(validateCity("<script>").ok).toBe(false);
    expect(validateCity("a".repeat(81)).ok).toBe(false);
  });
});
