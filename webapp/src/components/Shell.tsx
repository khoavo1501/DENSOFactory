import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Activity,
  Settings,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  LogOut,
  Keyboard,
} from "lucide-react";
import { useAuth, useTheme, useSound } from "@/store";
import { authApi } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import { ReconnectingWs, type WsStatus } from "@/api/ws";
import { ToastContainer } from "@/components/ToastContainer";

type ConnState = "connecting" | "live" | "stale" | "offline";

function mapStatus(s: WsStatus): ConnState {
  switch (s) {
    case "open":
      return "live";
    case "connecting":
      return "connecting";
    case "closed":
      return "offline";
    case "error":
    case "idle":
    default:
      return "stale";
  }
}

export function Shell() {
  const { user, setUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { soundEnabled, toggleSound } = useSound();
  const navigate = useNavigate();
  const [conn, setConn] = useState<ConnState>("connecting");
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    authApi
      .me()
      .then((u) => setUser(u))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          setUser(null);
        }
      });
  }, [setUser]);

  useEffect(() => {
    const ws = new ReconnectingWs("*");
    const off = ws.onStatus((s) => setConn(mapStatus(s)));
    ws.start();
    return () => {
      off();
      ws.stop();
    };
  }, []);

  // Keyboard shortcuts: t = theme, m = mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === "t" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggle();
      }
      if (e.key === "m" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleSound();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, toggleSound]);

  const onLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    setUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <div className="shell">
      <header className="topbar" role="banner">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            IG
          </span>
          <span className="brand-text">IIoT Gateway</span>
        </div>
        <span className="env-chip" aria-label="environment: development">
          DEV
        </span>
        <ConnectionIndicator state={conn} />
        <div className="spacer" />
        <div className="topbar-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleSound}
            title={`${soundEnabled ? "Mute alerts" : "Enable alerts"} (m)`}
            aria-label={
              soundEnabled ? "Mute critical alerts" : "Enable critical alerts"
            }
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? (
              <Volume2 size={14} aria-hidden />
            ) : (
              <VolumeX size={14} aria-hidden />
            )}
            <span className="btn-label">
              {soundEnabled ? "Sound on" : "Sound off"}
            </span>
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggle}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode (t)`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun size={14} aria-hidden />
            ) : (
              <Moon size={14} aria-hidden />
            )}
            <span className="btn-label">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>
        </div>
        {user && (
          <div className="user">
            <span className="user-name mono" title={user.username}>
              {user.username}
            </span>
            <span
              className={`role-pill role-${user.role}`}
              title={`Role: ${user.role}`}
            >
              {user.role}
            </span>
            <button
              className="btn btn-ghost btn-icon"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={14} aria-hidden />
            </button>
          </div>
        )}
      </header>

      <nav className="sidebar" aria-label="Primary">
        <div className="nav-group">
          <div className="nav-group-title">Overview</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-item${isActive ? " active" : ""}`
            }
          >
            <LayoutDashboard aria-hidden size={16} />
            Dashboard
          </NavLink>
        </div>
        <div className="nav-group">
          <div className="nav-group-title">Activity</div>
          <NavLink
            to="/events"
            className={({ isActive }) =>
              `nav-item${isActive ? " active" : ""}`
            }
          >
            <Calendar aria-hidden size={16} />
            Events
          </NavLink>
          <NavLink
            to="/diagnostics"
            className={({ isActive }) =>
              `nav-item${isActive ? " active" : ""}`
            }
          >
            <Activity aria-hidden size={16} />
            Diagnostics
          </NavLink>
        </div>
        {user?.role === "admin" && (
          <div className="nav-group">
            <div className="nav-group-title">Admin</div>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Settings aria-hidden size={16} />
              Settings
            </NavLink>
          </div>
        )}
        <div className="sidebar-footer">
          <button
            className="nav-item sidebar-hint-btn"
            onClick={() => setShowHint((v) => !v)}
            aria-expanded={showHint}
            title="Keyboard shortcuts"
          >
            <Keyboard aria-hidden size={14} />
            Shortcuts
          </button>
          {showHint && (
            <div className="kbd-hint" role="tooltip">
              <kbd>t</kbd>
              <span>toggle theme</span>
              <kbd>m</kbd>
              <span>toggle sound</span>
            </div>
          )}
        </div>
      </nav>

      <main className="main">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}

function ConnectionIndicator({ state }: { state: ConnState }) {
  const label =
    state === "live"
      ? "live"
      : state === "connecting"
        ? "connecting"
        : state === "stale"
          ? "reconnecting"
          : "offline";
  return (
    <span
      className={`conn-dot ${state}`}
      role="status"
      aria-live="polite"
      title={`WebSocket: ${label}`}
    >
      <span className="conn-pulse" aria-hidden />
      {label}
    </span>
  );
}