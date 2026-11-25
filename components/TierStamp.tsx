import type { Tier } from "@/lib/domain";
import styles from "./Results.module.css";

/** Tiers differ by shape and fill, not by colour alone. */
export function TierStamp({ tier }: { tier: Tier }) {
  return <span className={`${styles.tier ?? ""} ${styles[tier] ?? ""}`}>{tier}</span>;
}
