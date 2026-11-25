"use client";

import dynamic from "next/dynamic";
import { requestExcuses } from "./excuseClient";
import { browserLocate } from "./PlaceRow";
import { browserShareTools } from "./SlipActions";

/** Composition root for the browser: clock, randomness and adapters are injected here. */
const ExcuseApp = dynamic(() => import("./ExcuseApp").then((m) => m.ExcuseApp), {
  ssr: false,
  loading: () => <p style={{ padding: 16 }}>Typing up your slip…</p>,
});

const clock = () => new Date();
const random = () => Math.random();

export function ClientRoot({ eventsLive }: { eventsLive: boolean }) {
  return (
    <ExcuseApp
      clock={clock}
      random={random}
      locate={browserLocate}
      requestExcuses={requestExcuses}
      eventsLive={eventsLive}
      shareTools={browserShareTools}
    />
  );
}
