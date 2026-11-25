"use client";

import { useState } from "react";
import { parseLocalTime, toLocalTimeValue, type FormInput } from "@/lib/form";
import { estimateTraffic } from "@/lib/traffic";
import type { PlaceState } from "@/lib/place";
import { ContextBox } from "./ContextBox";
import { ExcuseForm, type FormDraft } from "./ExcuseForm";
import { PlaceRow, type Locate } from "./PlaceRow";
import { TrafficRow } from "./TrafficRow";
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
  const slot = parseLocalTime(draft.localTime);
  const traffic = slot ? estimateTraffic(slot) : null;
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
            <TrafficRow traffic={traffic} />
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
