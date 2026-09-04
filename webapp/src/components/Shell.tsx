import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useTheme, useSound } from "@/store";
import { authApi } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import { ToastStack } from "./Toast";

export function Shell() {
  const { user, setUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { soundEnabled, toggleSound } = useSound();
  const [railExpanded, setRailExpanded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Try to hydrate user from /api/auth/me (cookie-based).
    authApi
      .me()
      .then((u) => setUser(u))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          setUser(null);
        }
      });
  }, [setUser]);

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
    <div
      className={`shell${railExpanded ? " rail-expanded" : ""}`}
      onMouseLeave={() => setRailExpanded(false)}
    >
      <header className="topbar">
        <div className="brand">IIoT Gateway</div>
        <span className="env-chip">dev</span>
        <div className="spacer" />
        <button
          className="btn btn-ghost"
          onClick={toggleSound}
          title={soundEnabled ? "Sound on" : "Sound off"}
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={toggle}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        {user && (
          <div className="user">
            <span>
              {user.username} · {user.role}
            </span>
            <button className="btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </header>
      <nav
        className="rail"
        onMouseEnter={() => setRailExpanded(true)}
        aria-label="Primary"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          title="Overview"
        >
          <span className="icon" aria-hidden>
            ▦
          </span>
          <span className="label">Overview</span>
        </NavLink>
        <NavLink
          to="/events"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          title="Events"
        >
          <span className="icon" aria-hidden>
            ✦
          </span>
          <span className="label">Events</span>
        </NavLink>
        <NavLink
          to="/diagnostics"
          className={({ isActive }) => "item" + (isActive ? " active" : "")}
          title="Diagnostics"
        >
          <span className="icon" aria-hidden>
            ◆
          </span>
          <span className="label">Diagnostics</span>
        </NavLink>
        {user?.role === "admin" && (
          <NavLink
            to="/settings"
            className={({ isActive }) => "item" + (isActive ? " active" : "")}
            title="Settings"
          >
            <span className="icon" aria-hidden>
              ⚙
            </span>
            <span className="label">Settings</span>
          </NavLink>
        )}
      </nav>
      <main className="main">
        <Outlet />
      </main>
      <ToastStack />
    </div>
  );
}
