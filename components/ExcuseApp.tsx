"use client";

import { useState } from "react";
import { toLocalTimeValue, type FormInput } from "@/lib/form";
import { ExcuseForm, type FormDraft } from "./ExcuseForm";
import styles from "./ExcuseApp.module.css";

interface Props {
  clock: () => Date;
  random: () => number;
}

export function ExcuseApp({ clock, random }: Props) {
  const [slipNo] = useState(() => String(Math.floor(random() * 9000) + 1000));
  const [draft, setDraft] = useState<FormDraft>(() => ({
    reason: "",
    mode: "late",
    minutesLate: "15",
    localTime: toLocalTimeValue(clock()),
    audience: "",
  }));
  const [submitted, setSubmitted] = useState<FormInput | null>(null);

  return (
    <main className={styles.shell}>
      <ExcuseForm slipNo={slipNo} draft={draft} onDraftChange={setDraft} onSubmit={setSubmitted} />
      {submitted && (
        <p className={styles.pending} role="status">
          Slip filed. The excuse desk opens in a later build.
        </p>
      )}
      <footer className={styles.footer}>Hobby project. No ads, no payments, no accounts.</footer>
    </main>
  );
}
