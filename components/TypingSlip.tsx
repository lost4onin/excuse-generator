import styles from "./TypingSlip.module.css";

/** Loading state: a slip being typed. Static under reduced motion. */
export function TypingSlip() {
  return (
    <div className={["slip", styles.typing].join(" ")} role="status">
      <span className="label">Excuse desk</span>
      <p className={styles.line}>Typing up your slips…</p>
      <div className={styles.bars} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
