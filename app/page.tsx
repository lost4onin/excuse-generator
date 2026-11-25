import { ClientRoot } from "@/components/ClientRoot";
import { getConfig } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export default function Home() {
  // Only a boolean crosses to the browser, never the key itself.
  const eventsLive = getConfig().ticketmasterApiKey !== null;
  return <ClientRoot eventsLive={eventsLive} />;
}
