import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { Shell } from "@/components/Shell";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth, useTheme } from "@/store";
import { useEffect } from "react";
import type { ReactNode } from "react";

const OverviewPage = lazy(() =>
  import("@/pages/OverviewPage").then((m) => ({ default: m.OverviewPage }))
);
const DeviceDetailPage = lazy(() =>
  import("@/pages/DeviceDetailPage").then((m) => ({ default: m.DeviceDetailPage }))
);
const EventsPage = lazy(() =>
  import("@/pages/EventsPage").then((m) => ({ default: m.EventsPage }))
);
const DiagnosticsPage = lazy(() =>
  import("@/pages/DiagnosticsPage").then((m) => ({ default: m.DiagnosticsPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const GatewaysPage = lazy(() =>
  import("@/pages/GatewaysPage").then((m) => ({ default: m.GatewaysPage }))
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
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
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
      { index: true, element: <OverviewPage /> },
      { path: "devices/:id", element: <DeviceDetailPage /> },
      { path: "events", element: <EventsPage /> },
      { path: "diagnostics", element: <DiagnosticsPage /> },
      {
        path: "settings",
        element: (
          <AdminOnly>
            <SettingsPage />
          </AdminOnly>
        ),
      },
    ],
  },
]);

export function App() {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div className="empty">Loading...</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  );
}
