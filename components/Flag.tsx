import type { DataQuality } from "@/lib/domain";

const TEXT: Record<Exclude<DataQuality, "live">, string> = {
  estimated: "Estimated, not live",
  demo: "Demo data",
};

/** Red outline stamp next to the thing it describes. Text, never an image. */
export function Flag({ quality }: { quality: DataQuality }) {
  if (quality === "live") return null;
  return <span className="flag thump">{TEXT[quality]}</span>;
}

export function OfflineFlag() {
  return <span className="flag thump">Offline mode</span>;
}
