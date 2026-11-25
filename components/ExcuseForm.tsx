"use client";

import { useId, useState, type SubmitEvent, type ReactNode } from "react";
import { AUDIENCES, type Audience, type Mode } from "@/lib/domain";
import {
  MINUTES_MAX,
  QUICK_CHIPS,
  REASON_MAX,
  validateForm,
  type FieldErrors,
  type FormInput,
} from "@/lib/form";
import styles from "./ExcuseForm.module.css";

export interface FormDraft {
  reason: string;
  mode: Mode;
  minutesLate: string;
  localTime: string;
  audience: Audience | "";
}

interface Props {
  slipNo: string;
  draft: FormDraft;
  onDraftChange: (draft: FormDraft) => void;
  onSubmit: (input: FormInput) => void;
  /** The dashed context box (place, weather, traffic, events). */
  context?: ReactNode;
  busy?: boolean;
}

export function ExcuseForm({ slipNo, draft, onDraftChange, onSubmit, context, busy }: Props) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const id = useId();
  const set = <K extends keyof FormDraft>(key: K, value: FormDraft[K]) => {
    onDraftChange({ ...draft, [key]: value });
  };

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = validateForm({ ...draft });
    if (result.ok) {
      setErrors({});
      onSubmit(result.value);
    } else {
      setErrors(result.errors);
    }
  };

  const errorId = (field: keyof FieldErrors) => (errors[field] ? `${id}-${field}-err` : undefined);

  return (
    <form className={["slip", styles.form].join(" ")} onSubmit={handleSubmit} noValidate>
      <h1 className={styles.title}>
        Excuse slip <span className={styles.no}>No. {slipNo}</span>
      </h1>

      <div className={styles.field}>
        <label className="label" htmlFor={`${id}-reason`}>
          What for
        </label>
        <input
          id={`${id}-reason`}
          className={styles.input}
          value={draft.reason}
          maxLength={REASON_MAX}
          autoComplete="off"
          placeholder="the 9:00 stand-up"
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errorId("reason")}
          onChange={(e) => {
            set("reason", e.target.value);
          }}
        />
        <div className={styles.chips} role="group" aria-label="Quick picks">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={styles.chip}
              aria-pressed={draft.reason === chip}
              onClick={() => {
                set("reason", chip);
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        {errors.reason && (
          <p id={errorId("reason")} className={styles.error}>
            {errors.reason}
          </p>
        )}
      </div>

      <fieldset className={styles.field}>
        <legend className="label">Status</legend>
        <div className={styles.toggle}>
          {(["late", "absent"] as const).map((m) => (
            <label key={m} className={styles.toggleOption}>
              <input
                type="radio"
                name={`${id}-mode`}
                value={m}
                checked={draft.mode === m}
                onChange={() => {
                  set("mode", m);
                }}
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.row}>
        {draft.mode === "late" && (
          <div className={styles.field}>
            <label className="label" htmlFor={`${id}-minutes`}>
              How late (min)
            </label>
            <input
              id={`${id}-minutes`}
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={1}
              max={MINUTES_MAX}
              value={draft.minutesLate}
              aria-invalid={errors.minutesLate ? true : undefined}
              aria-describedby={errorId("minutesLate")}
              onChange={(e) => {
                set("minutesLate", e.target.value);
              }}
            />
            {errors.minutesLate && (
              <p id={errorId("minutesLate")} className={styles.error}>
                {errors.minutesLate}
              </p>
            )}
          </div>
        )}
        <div className={styles.field}>
          <label className="label" htmlFor={`${id}-time`}>
            {draft.mode === "late" ? "Expected at" : "Date and time"}
          </label>
          <input
            id={`${id}-time`}
            className={styles.input}
            type="datetime-local"
            value={draft.localTime}
            aria-invalid={errors.localTime ? true : undefined}
            aria-describedby={errorId("localTime")}
            onChange={(e) => {
              set("localTime", e.target.value);
            }}
          />
          {errors.localTime && (
            <p id={errorId("localTime")} className={styles.error}>
              {errors.localTime}
            </p>
          )}
        </div>
      </div>

      <fieldset className={styles.field} aria-describedby={errorId("audience")}>
        <legend className="label">Telling</legend>
        <div className={styles.pills}>
          {AUDIENCES.map((a) => (
            <label key={a} className={styles.pill}>
              <input
                type="radio"
                name={`${id}-audience`}
                value={a}
                checked={draft.audience === a}
                onChange={() => {
                  set("audience", a);
                }}
              />
              <span>{a}</span>
            </label>
          ))}
        </div>
        {errors.audience && (
          <p id={errorId("audience")} className={styles.error}>
            {errors.audience}
          </p>
        )}
      </fieldset>

      {context}

      <button type="submit" className={styles.issue} disabled={busy}>
        {busy ? "Typing up your slips…" : "Issue excuses"}
      </button>
      <p className={styles.note}>
        Excuses are written by an AI model when one is configured. Your reason is sent without your
        name or exact location.
      </p>
    </form>
  );
}
