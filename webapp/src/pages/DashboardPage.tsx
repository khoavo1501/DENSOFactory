import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Network, AlertTriangle, RefreshCw } from "lucide-react";
import { gatewaysApi, plcsApi, warningsApi } from "@/api/endpoints";
import { PageHeader } from "@/components/Breadcrumb";
import { GatewayCard, StatCard } from "@/components/GatewayCard";
import { ReconnectingWs } from "@/api/ws";
import type { Gateway, PLC, Warning } from "@/types";

export function DashboardPage() {
  const gatewaysQ = useQuery({
    queryKey: ["gateways"],
    queryFn: () => gatewaysApi.list(),
    refetchInterval: 30_000,
  });

  const plcsQ = useQuery({
    queryKey: ["plcs"],
    queryFn: () => plcsApi.list(),
    refetchInterval: 30_000,
  });

  const now = Math.floor(Date.now() / 1000);
  const warningsQ = useQuery({
    queryKey: ["warnings-active"],
    queryFn: () => warningsApi.list({ since: now - 24 * 3600 }),
    refetchInterval: 15_000,
  });

  // Live updates: refresh on any plc_update ws message.
  // (kept here for parity with prior design; refetchInterval already polls.)
  useMemo(() => new ReconnectingWs("*"), []);

  const gateways: Gateway[] = gatewaysQ.data ?? [];
  const plcs: PLC[] = plcsQ.data ?? [];
  const warnings: Warning[] = (warningsQ.data ?? []).filter(
    (w) => !w.cleared
  );

  const stats = useMemo(() => {
    const totalPlcs = plcs.length;
    const onlinePlcs = plcs.filter((p) => p.status === "online").length;
    const offlinePlcs = totalPlcs - onlinePlcs;
    const gatewaysOnline = gateways.filter(
      (g) => g.status === "online"
    ).length;
    const activeWarnings = warnings.length;
    return {
      gatewaysOnline,
      gatewaysTotal: gateways.length,
      plcsOnline: onlinePlcs,
      plcsTotal: totalPlcs,
      offlinePlcs,
      activeWarnings,
    };
  }, [gateways, plcs, warnings]);

  const plcsByGateway = useMemo(() => {
    const m = new Map<string, PLC[]>();
    for (const plc of plcs) {
      if (!m.has(plc.gateway_id)) m.set(plc.gateway_id, []);
      m.get(plc.gateway_id)!.push(plc);
    }
    return m;
  }, [plcs]);

  const isLoading = gatewaysQ.isLoading || plcsQ.isLoading;
  const isError = gatewaysQ.isError || plcsQ.isError;

  const onlinePct =
    stats.gatewaysTotal === 0
      ? 0
      : Math.round((stats.gatewaysOnline / stats.gatewaysTotal) * 100);
  const plcOnlinePct =
    stats.plcsTotal === 0
      ? 0
      : Math.round((stats.plcsOnline / stats.plcsTotal) * 100);

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={
          isLoading
            ? "loading…"
            : stats.gatewaysTotal === 0
              ? "no gateways registered"
              : `${stats.gatewaysOnline} of ${stats.gatewaysTotal} gateways online · ${onlinePct}%`
        }
        actions={
          <button
            className="btn btn-sm"
            onClick={() => {
              gatewaysQ.refetch();
              plcsQ.refetch();
            }}
          >
            <RefreshCw size={12} aria-hidden /> Refresh
          </button>
        }
      />

      <div className="stat-grid stagger">
        <StatCard
          label="Gateways online"
          value={`${stats.gatewaysOnline} / ${stats.gatewaysTotal}`}
          state={
            stats.gatewaysTotal === 0
              ? "neutral"
              : stats.gatewaysOnline === stats.gatewaysTotal
                ? "online"
                : stats.gatewaysOnline === 0
                  ? "offline"
                  : "warning"
          }
          icon={Network}
          hint={
            stats.gatewaysTotal === 0
              ? "no gateways registered"
              : `${onlinePct}% online`
          }
        />
        <StatCard
          label="PLC online"
          value={`${stats.plcsOnline} / ${stats.plcsTotal}`}
          state={
            stats.offlinePlcs === 0 && stats.plcsTotal > 0
              ? "online"
              : stats.offlinePlcs > 0
                ? "warning"
                : "neutral"
          }
          icon={Activity}
          hint={
            stats.plcsTotal === 0
              ? "no PLCs assigned"
              : stats.offlinePlcs > 0
                ? `${stats.offlinePlcs} offline · ${plcOnlinePct}% online`
                : "all connected"
          }
        />
        <StatCard
          label="Active warnings"
          value={stats.activeWarnings}
          state={
            stats.activeWarnings === 0
              ? "online"
              : stats.activeWarnings > 5
                ? "offline"
                : "warning"
          }
          icon={AlertTriangle}
          hint={
            stats.activeWarnings === 0
              ? "all clear"
              : stats.activeWarnings > 5
                ? "investigate now"
                : "review within shift"
          }
        />
      </div>

      {isError && (
        <div className="empty-state">
          <h3>Could not load dashboard</h3>
          <p>Check the connection to the API and try again.</p>
          <div className="empty-actions">
            <button
              className="btn btn-sm"
              onClick={() => {
                gatewaysQ.refetch();
                plcsQ.refetch();
              }}
            >
              <RefreshCw size={12} aria-hidden /> Retry
            </button>
          </div>
        </div>
      )}

      {!isError && isLoading && (
        <div className="gateway-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="gateway-card">
              <div className="skeleton skeleton-line" style={{ width: "60%" }}>
                &nbsp;
              </div>
              <div className="skeleton skeleton-line" style={{ width: "40%" }}>
                &nbsp;
              </div>
              <div
                className="skeleton skeleton-line"
                style={{ width: "80%", marginTop: 12 }}
              >
                &nbsp;
              </div>
            </div>
          ))}
        </div>
      )}

      {!isError && !isLoading && gateways.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden>
            <Network size={22} />
          </div>
          <h3>No gateways yet</h3>
          <p>
            Start a gateway (or the simulator) to publish to{" "}
            <code className="mono">devices/&lt;gateway_id&gt;/status</code>. The
            dashboard will populate within a couple of seconds.
          </p>
          <div className="empty-actions">
            <button
              className="btn btn-sm"
              onClick={() => {
                gatewaysQ.refetch();
                plcsQ.refetch();
              }}
            >
              <RefreshCw size={12} aria-hidden /> Retry
            </button>
          </div>
        </div>
      )}

      {!isError && !isLoading && gateways.length > 0 && (
        <div className="gateway-grid stagger">
          {gateways.map((g) => (
            <GatewayCard
              key={g.gateway_id}
              gateway={g}
              plcs={plcsByGateway.get(g.gateway_id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
