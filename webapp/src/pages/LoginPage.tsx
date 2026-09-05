import { useState, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { LogIn, Activity, Network, ShieldCheck } from "lucide-react";
import { authApi } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import { useAuth } from "@/store";

export function LoginPage() {
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await authApi.login(username, password);
      setUser(u);
      navigate("/", { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || "Sign in failed");
      } else {
        setError(String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <aside className="login-aside" aria-hidden>
        <div className="aside-top">
          <div className="aside-brand">
            <span className="brand-mark">IG</span>
            <span>iigw · webapp</span>
          </div>
          <h1 className="aside-headline">
            Industrial telemetry, in real time.
          </h1>
          <p className="aside-sub">
            A single dashboard for every Modbus gateway on the factory
            network — statuses, events, telemetry, and health, end-to end in
            under two seconds.
          </p>
          <div className="aside-stats">
            <div className="aside-stat">
              <span className="stat-num">≤ 2s</span>
              <span className="stat-text">realtime e2e</span>
            </div>
            <div className="aside-stat">
              <span className="stat-num">15</span>
              <span className="stat-text">gateways · bench 50</span>
            </div>
            <div className="aside-stat">
              <span className="stat-num">200</span>
              <span className="stat-text">registers / device</span>
            </div>
          </div>
        </div>
        <div className="aside-bottom">
          <div className="aside-meta">Modbus RTU · MQTT · InfluxDB · Postgres</div>
        </div>
      </aside>

      <section className="login-main">
        <form
          className="card login-card"
          onSubmit={onSubmit}
          noValidate
          aria-labelledby="login-title"
        >
          <div className="login-brand">
            <span className="brand-mark" aria-hidden>
              IG
            </span>
            <span>IIoT Gateway · Sign in</span>
          </div>
          <h1 id="login-title">Sign in</h1>
          <p className="login-subtitle">
            Access the industrial telemetry dashboard.
          </p>

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="error-msg" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            <LogIn size={14} aria-hidden />
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="login-hint" aria-label="demo credentials">
            <span>default</span>
            <span className="mono">admin / admin123</span>
          </div>

          <div className="login-features" aria-hidden>
            <span className="login-feature">
              <Activity size={12} /> realtime
            </span>
            <span className="login-feature">
              <Network size={12} /> MQTT
            </span>
            <span className="login-feature">
              <ShieldCheck size={12} /> JWT + CSRF
            </span>
          </div>
        </form>
      </section>
    </div>
  );
}