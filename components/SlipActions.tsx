"use client";

import { useState } from "react";
import styles from "./Results.module.css";

export interface ShareTools {
  copy: (text: string) => Promise<void>;
  /** Null when the browser has no native share sheet. */
  share: ((text: string) => Promise<void>) | null;
}

/** Browser adapter; looked up when used so nothing touches navigator during prerender. */
export const browserShareTools: ShareTools = {
  copy: (text) => navigator.clipboard.writeText(text),
  get share() {
    return typeof navigator !== "undefined" && typeof navigator.share === "function"
      ? (text: string) => navigator.share({ text })
      : null;
  },
};

export function SlipActions({ text, tools }: { text: string; tools: ShareTools }) {
  const [note, setNote] = useState("");
  const { share } = tools;
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.secondary}
        onClick={() => {
          tools.copy(text).then(
            () => {
              setNote("Copied");
            },
            () => {
              setNote("Copy failed. Long-press the text instead.");
            },
          );
        }}
      >
        Copy
      </button>
      {share && (
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            // A cancelled share sheet rejects; that is not an error worth showing.
            share(text).catch(() => undefined);
          }}
        >
          Share
        </button>
      )}
      <span className={styles.note} role="status">
        {note}
      </span>
    </div>
  );
}
