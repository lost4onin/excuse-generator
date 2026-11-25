"use client";

import { useState } from "react";
import { toLocalTimeValue, type FormInput } from "@/lib/form";
import type { PlaceState } from "@/lib/place";
import { ContextBox } from "./ContextBox";
import { ExcuseForm, type FormDraft } from "./ExcuseForm";
import { PlaceRow, type Locate } from "./PlaceRow";
import styles from "./ExcuseApp.module.css";

interface Props {
  clock: () => Date;
  random: () => number;
  locate: Locate;
}

export function ExcuseApp({ clock, random, locate }: Props) {
  const [slipNo] = useState(() => String(Math.floor(random() * 9000) + 1000));
  const [draft, setDraft] = useState<FormDraft>(() => ({
    reason: "",
    mode: "late",
    minutesLate: "15",
    localTime: toLocalTimeValue(clock()),
    audience: "",
  }));
  const [place, setPlace] = useState<PlaceState>({ kind: "idle" });
  const [submitted, setSubmitted] = useState<FormInput | null>(null);

  return (
    <main className={styles.shell}>
      <ExcuseForm
        slipNo={slipNo}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={setSubmitted}
        context={
          <ContextBox>
            <PlaceRow place={place} onChange={setPlace} locate={locate} />
          </ContextBox>
        }
      />
      {submitted && (
        <p className={styles.pending} role="status">
          Slip filed. The excuse desk opens in a later build.
        </p>
      )}
      <footer className={styles.footer}>Hobby project. No ads, no payments, no accounts.</footer>
    </main>
  );
}
