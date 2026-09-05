import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  Link,
} from "react-router-dom";
import { Shell } from "@/components/Shell";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth, useTheme } from "@/store";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Network, Cpu } from "lucide-react";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  }))
);
const GatewayDetailPage = lazy(() =>
  import("@/pages/GatewayDetailPage").then((m) => ({
    default: m.GatewayDetailPage,
  }))
);
const PLCDetailPage = lazy(() =>
  import("@/pages/PLCDetailPage").then((m) => ({
    default: m.PLCDetailPage,
  }))
);
const EventsPage = lazy(() =>
  import("@/pages/EventsPage").then((m) => ({ default: m.EventsPage }))
);
const DiagnosticsPage = lazy(() =>
  import("@/pages/DiagnosticsPage").then((m) => ({
    default: m.DiagnosticsPage,
  }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: "60dvh" }}>
      <div className="empty-icon" aria-hidden>
        <Network size={22} />
      </div>
      <h3>Page not found</h3>
      <p>The page you requested doesn't exist or has been moved.</p>
      <div className="empty-actions">
        <Link to="/" className="btn btn-sm btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <div className="page-header">
        <h1>
          <span className="skeleton" style={{ width: 220, height: 28 }}>
            &nbsp;
          </span>
        </h1>
      </div>
      <div className="stat-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="stat-card">
            <span className="skeleton skeleton-line" style={{ width: 60 }}>
              &nbsp;
            </span>
            <span className="skeleton skeleton-stat">&nbsp;</span>
            <span className="skeleton skeleton-line" style={{ width: 80 }}>
              &nbsp;
            </span>
          </div>
        ))}
      </div>
      <div className="gateway-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="gateway-card">
            <div className="skeleton skeleton-line" style={{ width: "55%" }}>
              &nbsp;
            </div>
            <div
              className="skeleton skeleton-line"
              style={{ width: "70%", marginTop: 12 }}
            >
              &nbsp;
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <Protected>
        <Shell />
      </Protected>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: "gateways/:id",
        element: <GatewayDetailPage />,
      },
      {
        path: "gateways/:gatewayId/plc/:plcId",
        element: <PLCDetailPage />,
      },
      { path: "events", element: <EventsPage /> },
      { path: "diagnostics", element: <DiagnosticsPage /> },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export function App() {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<PageFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  );
}

// Avoid unused warning for Cpu in NotFound fallback path
void Cpu;
