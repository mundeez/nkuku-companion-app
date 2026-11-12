// Hatch-day display convention — mirrors apps/api/src/core/day-convention.ts.
//
// Internal ageDays is always 0-based elapsed days. The org-level
// hatchDayConvention setting controls user-facing "Day N" labels:
//   'day1' (default): hatch day displays as Day 1 → displayDay = ageDays + 1
//   'day0':           hatch day displays as Day 0 → displayDay = ageDays
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api/client";

export type HatchDayConvention = "day0" | "day1";

let cache: HatchDayConvention | null = null;

// Called from the settings page after saving so other screens pick up the
// new convention without a reload.
export function setHatchDayConventionCache(c: HatchDayConvention) {
  cache = c;
}

export function useHatchDayConvention(): HatchDayConvention {
  const [conv, setConv] = useState<HatchDayConvention>(cache ?? "day1");
  useEffect(() => {
    if (cache) return;
    apiFetch<{ hatchDayConvention?: HatchDayConvention }>("/api/v1/organizations/me")
      .then((o) => {
        cache = o?.hatchDayConvention === "day0" ? "day0" : "day1";
        setConv(cache);
      })
      .catch(() => {});
  }, []);
  return conv;
}

export function displayDay(ageDays: number, convention: HatchDayConvention): number {
  return convention === "day0" ? ageDays : ageDays + 1;
}
