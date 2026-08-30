// Time range helpers (D-02 Grafana-style quick ranges + custom).

export type QuickRange = "5m" | "15m" | "1h" | "6h" | "24h" | "7d" | "custom";

export const QUICK_RANGES: QuickRange[] = ["5m", "15m", "1h", "6h", "24h", "7d"];

const QUICK_RANGE_SECONDS: Record<Exclude<QuickRange, "custom">, number> = {
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 3600,
  "6h": 6 * 3600,
  "24h": 24 * 3600,
  "7d": 7 * 24 * 3600,
};

export interface TimeRange {
  from: number; // Unix seconds
  to: number; // Unix seconds
  label?: string; // human-readable, e.g. "Last 1h"
}

export function rangeForQuick(range: Exclude<QuickRange, "custom">, to?: number): TimeRange {
  const now = to ?? Math.floor(Date.now() / 1000);
  const from = now - QUICK_RANGE_SECONDS[range];
  return { from, to: now, label: `Last ${range}` };
}

export function rangeCustom(from: number, to: number): TimeRange {
  return { from, to, label: `${formatDateTime(from)} → ${formatDateTime(to)}` } as TimeRange;
}

export function formatDateTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString();
}

export function rangeLabel(range: TimeRange): string {
  return range.label ?? "";
}

// Resolve range token + custom to a TimeRange (defaults to last 24h)
export function resolveRange(
  token: QuickRange,
  customFrom?: number,
  customTo?: number
): TimeRange {
  if (token === "custom") {
    if (customFrom && customTo && customFrom < customTo) {
      return rangeCustom(customFrom, customTo);
    }
    return rangeForQuick("24h");
  }
  return rangeForQuick(token);
}
