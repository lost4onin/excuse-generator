import { describe, expect, it } from "vitest";
import { parseLocalTime, toLocalTimeValue, validateForm } from "@/lib/form";

const base = {
  reason: "team meeting",
  mode: "late",
  minutesLate: "15",
  localTime: "2026-11-25T09:00",
  audience: "boss",
};

describe("parseLocalTime", () => {
  it("reads hour and weekday", () => {
    // 25 Nov 2026 is a Wednesday.
    expect(parseLocalTime("2026-11-25T09:00")).toEqual({ localHour: 9, weekday: 3 });
  });

  it("rejects impossible dates and junk", () => {
    expect(parseLocalTime("2026-02-30T09:00")).toBeNull();
    expect(parseLocalTime("2026-11-25T24:00")).toBeNull();
    expect(parseLocalTime("tomorrow-ish")).toBeNull();
  });

  it("round-trips a clock reading", () => {
    const value = toLocalTimeValue(new Date(2026, 0, 5, 7, 4));
    expect(value).toBe("2026-01-05T07:04");
  });
});

describe("validateForm", () => {
  it("accepts a late excuse request", () => {
    const r = validateForm(base);
    expect(r).toEqual({
      ok: true,
      value: {
        reason: "team meeting",
        mode: "late",
        minutesLate: 15,
        localTime: "2026-11-25T09:00",
        localHour: 9,
        weekday: 3,
        audience: "boss",
      },
    });
  });

  it("ignores minutes when absent", () => {
    const r = validateForm({ ...base, mode: "absent", minutesLate: "" });
    expect(r.ok && r.value.minutesLate).toBe(undefined);
  });

  it("collapses whitespace and caps length", () => {
    const r = validateForm({ ...base, reason: "  dentist \n\n  appointment " });
    expect(r.ok && r.value.reason).toBe("dentist appointment");
    const long = validateForm({ ...base, reason: "a".repeat(201) });
    expect(long.ok).toBe(false);
    expect(!long.ok && long.errors.reason).toMatch(/200/);
  });

  it("reports every bad field at once", () => {
    const r = validateForm({ ...base, reason: "", audience: "landlord", localTime: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["audience", "reason"]);
    }
  });

  it("bounds minutes late", () => {
    for (const m of ["0", "241", "2.5", "", "abc"]) {
      const r = validateForm({ ...base, minutesLate: m });
      expect(!r.ok && r.errors.minutesLate).toBeTruthy();
    }
  });

  it("rejects a bad time", () => {
    const r = validateForm({ ...base, localTime: "2026-13-01T10:00" });
    expect(!r.ok && r.errors.localTime).toBeTruthy();
  });
});
