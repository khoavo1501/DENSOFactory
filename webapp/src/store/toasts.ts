import { create } from "zustand";
import type { Severity, EventCode } from "@/types";

export interface ToastItem {
  id: string;
  severity: Severity;
  code: EventCode;
  message?: string;
  device_id: string;
  ts: number;
  count: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id" | "count" | "ts"> & { ts?: number }) => void;
  remove: (id: string) => void;
  clear: () => void;
}

// Group window: 5s — duplicate (same device+code) increments count instead.
const GROUP_WINDOW_MS = 5000;
const MAX_TOASTS = 5;

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const ts = t.ts ?? Math.floor(Date.now() / 1000);
    const existing = get().toasts.find(
      (x) =>
        x.device_id === t.device_id &&
        x.code === t.code &&
        ts - x.ts < GROUP_WINDOW_MS / 1000
    );
    if (existing) {
      set({
        toasts: get().toasts.map((x) =>
          x.id === existing.id ? { ...x, count: x.count + 1, ts } : x
        ),
      });
      return;
    }
    const item: ToastItem = { ...t, id: uuid(), ts, count: 1 };
    const next = [item, ...get().toasts].slice(0, MAX_TOASTS);
    set({ toasts: next });
  },
  remove: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  clear: () => set({ toasts: [] }),
}));
