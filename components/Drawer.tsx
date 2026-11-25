"use client";

import { useState } from "react";
import { repeatedPairs, type HistoryEntry } from "@/lib/history";
import { TierStamp } from "./TierStamp";
import styles from "./Drawer.module.css";

interface Props {
  entries: HistoryEntry[];
  now: Date;
  onReuse: (entry: HistoryEntry) => Promise<void>;
  onClear: () => void;
}

export function Drawer({ entries, now, onReuse, onClear }: Props) {
  const repeats = repeatedPairs(entries, now);
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <section className={styles.drawer} aria-labelledby="drawer-title">
      <h2 id="drawer-title" className={styles.title}>
        Back of the drawer
      </h2>
      <p className={styles.note}>
        The last 10 slips you copied or shared. Stored only in this browser.
      </p>

      {repeats.length > 0 && (
        <div className={styles.risk} role="note">
          <strong>Repeat risk</strong>
          <ul>
            {repeats.map((e) => (
              <li key={e.id}>Same angle told to your {e.audience} more than once in two weeks.</li>
            ))}
          </ul>
        </div>
      )}

      {entries.length === 0 ? (
        <p className={`slip ${styles.empty ?? ""}`}>
          Empty. Copy or share a slip and it lands here.
        </p>
      ) : (
        <ol className={styles.list}>
          {entries.map((e) => (
            <li key={e.id} className={`slip ${styles.item ?? ""}`}>
              <div className={styles.meta}>
                <TierStamp tier={e.tier} />
                <span>
                  to {e.audience} · {e.at.slice(0, 10)}
                </span>
              </div>
              <p className={styles.reason}>for: {e.reason}</p>
              <p className={styles.text}>{e.text}</p>
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  onReuse(e).then(
                    () => {
                      setCopied(e.id);
                    },
                    () => {
                      setCopied(null);
                    },
                  );
                }}
              >
                Reuse
              </button>
              <span className={styles.copied} role="status">
                {copied === e.id ? "Copied again" : ""}
              </span>
            </li>
          ))}
        </ol>
      )}

      {entries.length > 0 && (
        <button type="button" className={styles.clear} onClick={onClear}>
          Clear history
        </button>
      )}
    </section>
  );
}
