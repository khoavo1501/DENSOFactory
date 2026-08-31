import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

type Theme = "dark" | "light";

interface AuthState {
  user: User | null;
  setUser: (u: User | null) => void;
  isAdmin: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (u) => set({ user: u }),
      isAdmin: () => get().user?.role === "admin",
    }),
    { name: "iigw.auth" }
  )
);

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (t) => {
        set({ theme: t });
        applyTheme(t);
      },
      toggle: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        applyTheme(next);
      },
    }),
    { name: "iigw.theme" }
  )
);

function applyTheme(t: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", t);
  }
}


// ====== Sound toggle (M5) ======
interface SoundState {
  soundEnabled: boolean;
  setSound: (on: boolean) => void;
  toggleSound: () => void;
}

export const useSound = create<SoundState>()(
  persist(
    (set, get) => ({
      soundEnabled: false, // D-07: default OFF
      setSound: (on) => set({ soundEnabled: on }),
      toggleSound: () => set({ soundEnabled: !get().soundEnabled }),
    }),
    { name: "iigw.sound" }
  )
);

let _audioCtx: AudioContext | null = null;
function _getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    _audioCtx = new Ctor();
  }
  return _audioCtx;
}

// Beep cho critical event: 2-tone 880/660Hz, 250ms total
export function playCriticalBeep(): void {
  const ctx = _getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const o1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  o1.frequency.value = 880;
  o1.connect(g1);
  g1.connect(ctx.destination);
  g1.gain.setValueAtTime(0.15, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  o1.start(now);
  o1.stop(now + 0.13);

  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.frequency.value = 660;
  o2.connect(g2);
  g2.connect(ctx.destination);
  g2.gain.setValueAtTime(0.15, now + 0.13);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  o2.start(now + 0.13);
  o2.stop(now + 0.26);
}
