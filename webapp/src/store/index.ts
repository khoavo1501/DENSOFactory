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
