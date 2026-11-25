import type { ReactNode } from "react";
import styles from "./ContextBox.module.css";

/** The dashed box on the form that lists what context the excuses will use. */
export function ContextBox({ children }: { children: ReactNode }) {
  return (
    <section className={styles.box} aria-label="Context">
      {children}
    </section>
  );
}
