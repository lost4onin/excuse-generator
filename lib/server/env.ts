import "server-only";
import { parseConfig, type Config } from "@/lib/config";

/** Server-side accessor; importing this from a client component fails the build. */
export function getConfig(): Config {
  return parseConfig(process.env);
}
