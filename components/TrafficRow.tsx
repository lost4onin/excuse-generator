import type { TrafficEstimate } from "@/lib/domain";
import { Flag } from "./Flag";
import styles from "./ContextBox.module.css";

export function TrafficRow({ traffic }: { traffic: TrafficEstimate | null }) {
  return (
    <div className={styles.row}>
      <span className="label">Traffic</span>
      <div className={styles.value}>
        {traffic ? (
          <>
            <span>
              {traffic.level}: {traffic.reason}
            </span>
            <Flag quality={traffic.quality} />
          </>
        ) : (
          <span>Set a time to estimate it.</span>
        )}
      </div>
    </div>
  );
}
