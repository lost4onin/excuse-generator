"use client";

import dynamic from "next/dynamic";
import { browserLocate } from "./PlaceRow";

/** Composition root for the browser: the clock and random source are injected here. */
const ExcuseApp = dynamic(() => import("./ExcuseApp").then((m) => m.ExcuseApp), {
  ssr: false,
  loading: () => <p style={{ padding: 16 }}>Typing up your slip…</p>,
});

const clock = () => new Date();
const random = () => Math.random();

export function ClientRoot() {
  return <ExcuseApp clock={clock} random={random} locate={browserLocate} />;
}
