"use client";

import { useEffect, useState } from "react";
import type { ExcuseResponse } from "@/lib/api";
import { parseLocalTime, toLocalTimeValue, type FormInput } from "@/lib/form";
import type { PlaceState } from "@/lib/place";
import { estimateTraffic } from "@/lib/traffic";
import { ContextBox } from "./ContextBox";
import type { RequestExcuses } from "./excuseClient";
import { ExcuseForm, type FormDraft } from "./ExcuseForm";
import { Flag } from "./Flag";
import { PlaceRow, type Locate } from "./PlaceRow";
import { Results } from "./Results";
import { TrafficRow } from "./TrafficRow";
import box from "./ContextBox.module.css";
import styles from "./ExcuseApp.module.css";

interface Props {
  clock: () => Date;
  random: () => number;
  locate: Locate;
  requestExcuses: RequestExcuses;
  /** True when the server has an events key; otherwise events are demo data. */
  eventsLive: boolean;
}

type View = "form" | "results";

export function ExcuseApp({ clock, random, locate, requestExcuses, eventsLive }: Props) {
  const [slipNo] = useState(() => String(Math.floor(random() * 9000) + 1000));
  const [draft, setDraft] = useState<FormDraft>(() => ({
    reason: "",
    mode: "late",
    minutesLate: "15",
    localTime: toLocalTimeValue(clock()),
    audience: "",
  }));
  const [place, setPlace] = useState<PlaceState>({ kind: "idle" });
  const [view, setView] = useState<View>("form");
  const [lastInput, setLastInput] = useState<FormInput | null>(null);
  const [response, setResponse] = useState<ExcuseResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const slot = parseLocalTime(draft.localTime);
  const traffic = slot ? estimateTraffic(slot) : null;

  // Browser back from Results returns to the form, inputs intact.
  useEffect(() => {
    const onPop = () => {
      setView("form");
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const issue = async (input: FormInput, avoid: string[]) => {
    setBusy(true);
    setLastInput(input);
    const seed = Math.floor(random() * 2 ** 31);
    const res = await requestExcuses(input, place, avoid, seed);
    setResponse(res);
    setBusy(false);
    if (view !== "results") {
      window.history.pushState({ view: "results" }, "");
      setView("results");
      window.scrollTo({ top: 0 });
    }
  };

  const reroll = () => {
    if (!lastInput || !response) return;
    void issue(
      lastInput,
      response.set.excuses.map((e) => e.text),
    );
  };

  return (
    <main className={styles.shell}>
      {view === "form" && (
        <ExcuseForm
          slipNo={slipNo}
          draft={draft}
          onDraftChange={setDraft}
          busy={busy}
          onSubmit={(input) => {
            void issue(input, []);
          }}
          context={
            <ContextBox>
              <PlaceRow place={place} onChange={setPlace} locate={locate} />
              <div className={box.row}>
                <span className="label">Weather</span>
                <div className={box.value}>
                  <span>
                    {place.kind === "located" || place.kind === "manual"
                      ? "Checked live when you issue"
                      : "Needs a place"}
                  </span>
                </div>
              </div>
              <TrafficRow traffic={traffic} />
              <div className={box.row}>
                <span className="label">Events</span>
                <div className={box.value}>
                  <span>{eventsLive ? "Nearby, from Ticketmaster" : "Sample events"}</span>
                  {!eventsLive && <Flag quality="demo" />}
                </div>
              </div>
            </ContextBox>
          }
        />
      )}
      {view === "results" && response && (
        <Results
          response={response}
          busy={busy}
          onReroll={reroll}
          onEdit={() => {
            window.history.back();
          }}
        />
      )}
      <footer className={styles.footer}>
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Weather by Open-Meteo
        </a>
        <span>Hobby project. No ads, no payments, no accounts.</span>
      </footer>
    </main>
  );
}
