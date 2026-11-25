import { z } from "zod";
import { AUDIENCES, MODES, type Audience, type Mode } from "@/lib/domain";

export const REASON_MAX = 200;
export const MINUTES_MAX = 240;
export const QUICK_CHIPS = ["meeting", "class", "dinner", "shift", "call"] as const;

/** What the form submits, after validation. */
export interface FormInput {
  reason: string;
  mode: Mode;
  minutesLate?: number;
  /** Local wall-clock time as typed, "YYYY-MM-DDTHH:mm". */
  localTime: string;
  localHour: number;
  weekday: number;
  audience: Audience;
}

export type FieldErrors = Partial<
  Record<"reason" | "minutesLate" | "localTime" | "audience", string>
>;

const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Splits a datetime-local value into hour and weekday without touching the
 * runtime time zone: the string already is local wall-clock time.
 */
export function parseLocalTime(value: string): { localHour: number; weekday: number } | null {
  const m = LOCAL_TIME.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCDate() !== day) return null;
  return { localHour: hour, weekday: utc.getUTCDay() };
}

/** Formats a clock reading as a datetime-local value in the viewer's zone. */
export function toLocalTimeValue(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const rawSchema = z.object({
  reason: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, "Say what you are missing.")
        .max(REASON_MAX, `Keep it under ${String(REASON_MAX)} characters.`),
    ),
  mode: z.enum(MODES),
  minutesLate: z.string().optional(),
  localTime: z.string(),
  audience: z.enum(AUDIENCES, { error: "Pick who you are telling." }),
});

export type RawForm = z.input<typeof rawSchema>;

export function validateForm(
  raw: Record<string, unknown>,
): { ok: true; value: FormInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const parsed = rawSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "reason" || key === "audience" || key === "localTime" || key === "minutesLate") {
        errors[key] ??= issue.message;
      } else {
        errors.reason ??= "Something in the form is off.";
      }
    }
    return { ok: false, errors };
  }
  const data = parsed.data;
  const time = parseLocalTime(data.localTime);
  if (!time) errors.localTime = "Use a real date and time.";

  let minutesLate: number | undefined;
  if (data.mode === "late") {
    const n = Number(data.minutesLate);
    if (!data.minutesLate || !Number.isInteger(n) || n < 1 || n > MINUTES_MAX) {
      errors.minutesLate = `Between 1 and ${String(MINUTES_MAX)} minutes.`;
    } else {
      minutesLate = n;
    }
  }
  if (!time || Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      reason: data.reason,
      mode: data.mode,
      ...(minutesLate !== undefined ? { minutesLate } : {}),
      localTime: data.localTime,
      localHour: time.localHour,
      weekday: time.weekday,
      audience: data.audience,
    },
  };
}
