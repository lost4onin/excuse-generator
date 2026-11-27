/** Errors as values. Kinds map to responses in one place (the API route). */
export type ErrorKind =
  "validation" | "not_found" | "forbidden" | "rate_limited" | "upstream" | "internal";

export interface AppError {
  kind: ErrorKind;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(kind: ErrorKind, message: string): Result<T> => ({
  ok: false,
  error: { kind, message },
});
