"use client";

import { useEffect, useState } from "react";
import type { ExcuseResponse } from "@/lib/api";
import type { Excuse } from "@/lib/domain";
import { parseLocalTime, toLocalTimeValue, type FormInput } from "@/lib/form";
import { addEntry, repeatRisk, type HistoryEntry, type HistoryStore } from "@/lib/history";
import type { PlaceState } from "@/lib/place";
import { estimateTraffic } from "@/lib/traffic";
import { ContextBox } from "./ContextBox";
import { Drawer } from "./Drawer";
import type { RequestExcuses } from "./excuseClient";
import { ExcuseForm, type FormDraft } from "./ExcuseForm";
import { Flag } from "./Flag";
import { PlaceRow, type Locate } from "./PlaceRow";
import { Results } from "./Results";
import { SlipActions, type ShareTools } from "./SlipActions";
import { TrafficRow } from "./TrafficRow";
import { TypingSlip } from "./TypingSlip";
import box from "./ContextBox.module.css";
import styles from "./ExcuseApp.module.css";

interface Props {
  clock: () => Date;
  random: () => number;
  locate: Locate;
  requestExcuses: RequestExcuses;
  /** True when the server has an events key; otherwise events are demo data. */
  eventsLive: boolean;
  shareTools: ShareTools;
  history: HistoryStore;
}

type View = "form" | "results" | "drawer";

export function ExcuseApp({
  clock,
  random,
  locate,
  requestExcuses,
  eventsLive,
  shareTools,
  history,
}: Props) {
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
  const [entries, setEntries] = useState<HistoryEntry[]>(() => history.load());

  const slot = parseLocalTime(draft.localTime);
  const traffic = slot ? estimateTraffic(slot) : null;

  // Browser back always returns to the form, inputs intact.
  useEffect(() => {
    const onPop = () => {
      setView("form");
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const go = (next: View) => {
    if (next === view) return;
    if (next === "form") {
      window.history.back();
      return;
    }
    if (view === "form") window.history.pushState({ view: next }, "");
    else window.history.replaceState({ view: next }, "");
    setView(next);
    window.scrollTo({ top: 0 });
  };

  const issue = async (input: FormInput, avoid: string[]) => {
    setBusy(true);
    setLastInput(input);
    const seed = Math.floor(random() * 2 ** 31);
    const res = await requestExcuses(input, place, avoid, seed);
    setResponse(res);
    setBusy(false);
    go("results");
  };

  const reroll = () => {
    if (!lastInput || !response) return;
    void issue(
      lastInput,
      response.set.excuses.map((e) => e.text),
    );
  };

  const remember = (excuse: Excuse) => {
    if (!lastInput || response?.set.source === "refusal") return;
    const now = clock();
    const next = addEntry(entries, {
      id: `${String(now.getTime())}-${String(Math.floor(random() * 1e6))}`,
      at: now.toISOString(),
      audience: lastInput.audience,
      reason: lastInput.reason,
      tier: excuse.tier,
      tag: excuse.tag,
      text: excuse.text,
    });
    setEntries(next);
    history.save(next);
  };

  const slipActions = (excuse: Excuse) => {
    const risky =
      lastInput !== null && repeatRisk(entries, lastInput.audience, excuse, clock()).length > 0;
    return (
      <>
        {risky && (
          <p className={styles.warning}>
            Repeat risk: you told your {lastInput.audience} something like this recently.
          </p>
        )}
        <SlipActions
          text={excuse.text}
          tools={shareTools}
          onUsed={() => {
            remember(excuse);
          }}
        />
      </>
    );
  };

  return (
    <main className={styles.shell}>
      <nav className={styles.nav} aria-label="Views">
        <button
          type="button"
          aria-current={view === "form" ? "page" : undefined}
          onClick={() => {
            go("form");
          }}
        >
          New
        </button>
        <button
          type="button"
          aria-current={view === "drawer" ? "page" : undefined}
          onClick={() => {
            go("drawer");
          }}
        >
          Drawer ({entries.length})
        </button>
      </nav>

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
            go("form");
          }}
          actions={slipActions}
        />
      )}
      {view === "drawer" && (
        <Drawer
          entries={entries}
          now={clock()}
          onReuse={(e) => {
            return shareTools.copy(e.text);
          }}
          onClear={() => {
            setEntries([]);
            history.save([]);
          }}
        />
      )}
      {busy && <TypingSlip />}
      <footer className={styles.footer}>
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Weather by Open-Meteo
        </a>
        <span>Hobby project. No ads, no payments, no accounts.</span>
      </footer>
    </main>
  );
}
