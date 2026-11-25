"use client";

import { useId, useState } from "react";
import { coarsen, validateCity, type Coords, type PlaceState } from "@/lib/place";
import styles from "./ContextBox.module.css";

export type Locate = () => Promise<Coords>;

/** Browser adapter for the location port. */
export const browserLocate: Locate = () =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (e) => {
        reject(new Error(e.message));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  });

interface Props {
  place: PlaceState;
  onChange: (place: PlaceState) => void;
  locate: Locate;
}

export function PlaceRow({ place, onChange, locate }: Props) {
  const id = useId();
  const [city, setCity] = useState(place.kind === "manual" ? place.city : "");
  const [error, setError] = useState<string | null>(null);

  const useLocation = () => {
    onChange({ kind: "locating" });
    locate().then(
      (coords) => {
        const c = coarsen(coords);
        onChange(c ? { kind: "located", coords: c } : { kind: "denied" });
      },
      () => {
        onChange({ kind: "denied" });
      },
    );
  };

  const saveCity = () => {
    const r = validateCity(city);
    if (r.ok) {
      setError(null);
      onChange({ kind: "manual", city: r.city });
    } else {
      setError(r.error);
    }
  };

  const showCityField = place.kind === "denied" || place.kind === "manual" || place.kind === "idle";

  return (
    <div className={styles.row}>
      <span className="label">Place</span>
      <div className={styles.value}>
        {place.kind === "located" && <span>Near you (about 1 km)</span>}
        {place.kind === "locating" && <span>Finding you…</span>}
        {place.kind === "manual" && <span>{place.city}</span>}
        {place.kind === "denied" && <span>Location off. Type a city instead.</span>}
        {place.kind !== "locating" && place.kind !== "located" && (
          <button type="button" className={styles.action} onClick={useLocation}>
            Use my location
          </button>
        )}
      </div>
      {showCityField && (
        <div className={styles.city}>
          <label className="visually-hidden" htmlFor={`${id}-city`}>
            City
          </label>
          <input
            id={`${id}-city`}
            className={styles.input}
            value={city}
            placeholder="or type a city"
            autoComplete="address-level2"
            maxLength={80}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-city-err` : undefined}
            onChange={(e) => {
              setCity(e.target.value);
            }}
            onBlur={() => {
              if (city.trim() !== "") saveCity();
            }}
          />
          {error && (
            <p id={`${id}-city-err`} className={styles.error}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
