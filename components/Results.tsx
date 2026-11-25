"use client";

import type { ReactNode } from "react";
import type { ExcuseResponse } from "@/lib/api";
import type { Excuse } from "@/lib/domain";
import { Flag, OfflineFlag } from "./Flag";
import { TierStamp } from "./TierStamp";
import styles from "./Results.module.css";

interface Props {
  response: ExcuseResponse;
  busy: boolean;
  onEdit: () => void;
  onReroll: () => void;
  /** Per-slip actions (copy, share), rendered under the text. */
  actions?: (excuse: Excuse) => ReactNode;
}

function summary(used: ExcuseResponse["used"]): string {
  const parts: string[] = [];
  if (used.place) parts.push(used.place);
  if (used.weather) parts.push(used.weather);
  if (used.traffic) parts.push(`${used.traffic.level} traffic`);
  if (used.events?.names[0]) parts.push(used.events.names[0].name);
  return parts.length ? `Used: ${parts.join(" · ")}` : "Used: nothing but the clock";
}

export function Results({ response, busy, onEdit, onReroll, actions }: Props) {
  const { set, used } = response;
  const offline = set.source === "templates";
  return (
    <section className={styles.results} aria-labelledby="slips-title">
      <header className={styles.header}>
        <h2 id="slips-title" className={styles.title}>
          Your slips
        </h2>
        {offline && <OfflineFlag />}
      </header>
      <div className={styles.summary}>
        <p>{summary(used)}</p>
        {used.traffic && <Flag quality="estimated" />}
        {used.events?.quality === "demo" && <Flag quality="demo" />}
        <button type="button" className={styles.secondary} onClick={onEdit}>
          Edit
        </button>
      </div>
      {used.events?.quality === "live" && used.events.names.some((e) => e.url) && (
        <p className={styles.events}>
          Events:{" "}
          {used.events.names.map((e, i) =>
            e.url ? (
              <a key={i} href={e.url} target="_blank" rel="noopener noreferrer">
                {e.name}
              </a>
            ) : null,
          )}
        </p>
      )}

      <ol className={styles.list} aria-live="polite" aria-busy={busy}>
        {set.excuses.map((excuse, i) => (
          <li
            key={`${excuse.tier}-${excuse.text}`}
            className={`slip slide-in ${styles.item ?? ""}`}
          >
            <div className={styles.meta}>
              <TierStamp tier={excuse.tier} />
              <span className={styles.count}>{i + 1} of 3</span>
            </div>
            <p className={styles.text}>{excuse.text}</p>
            {excuse.flags.length > 0 && (
              <div className={styles.flags}>
                {excuse.flags.map((f) => (
                  <Flag key={f} quality={f} />
                ))}
              </div>
            )}
            {actions?.(excuse)}
          </li>
        ))}
      </ol>

      <button type="button" className={styles.primary} onClick={onReroll} disabled={busy}>
        {busy ? "Typing up your slips…" : "Issue new slips"}
      </button>
    </section>
  );
}
