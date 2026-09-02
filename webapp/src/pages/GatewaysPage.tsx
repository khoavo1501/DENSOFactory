import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gatewaysApi, plcsApi, unpairedApi, warningsApi } from "@/api/endpoints";
import { ReconnectingWs } from "@/api/ws";
import { GatewayCard, PLCCard, UnpairedSection } from "@/components/Plc";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { resolveRange } from "@/utils/timeRange";
import type { Gateway, PLC, Warning, PLCSnapshot } from "@/types";

const NORMAL_POLL_MS = 60_000; // 1 phút
const REALTIME_WS = true;

export function GatewaysPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState(() => resolveRange("1h"));
  const [expandedGateways, setExpandedGateways] = useState<Set<string>>(
    new Set()
  );
  const [realtimePlcIds, setRealtimePlcIds] = useState<Set<string>>(
    new Set()
  );
  const [now, setNow] = useState(() => Date.now());
  const wsRef = useRef<ReconnectingWs | null>(null);

  // Tick every second to update age labels and trigger normal-poll checks.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Determine "is realtime" per PLC: warning active OR within last 60s since
  // warning was raised. For simplicity here, we treat any PLC with an active
  // warning as realtime. We also force a normal poll for non-realtime PLCs.
  const warningsQ = useQuery({
    queryKey: ["warnings", range],
    queryFn: () => warningsApi.list({ since: range.from }),
    refetchInterval: 15_000,
  });

  const activeWarnings: Warning[] = useMemo(() => {
    return (warningsQ.data ?? []).filter((w) => !w.cleared);
  }, [warningsQ.data]);

  // Auto-mark PLC realtime if it has any active warning.
  useEffect(() => {
    const plcIdsWithWarn = new Set(
      activeWarnings
        .filter((w) => w.target_type === "plc")
        .map((w) => w.target_id)
    );
    setRealtimePlcIds(plcIdsWithWarn);
  }, [activeWarnings]);

  const gatewaysQ = useQuery({
    queryKey: ["gateways"],
    queryFn: () => gatewaysApi.list(),
    refetchInterval: 30_000,
  });

  const plcsQ = useQuery({
    queryKey: ["plcs", realtimePlcIds.size],
    queryFn: () => plcsApi.list(),
    refetchInterval: realtimePlcIds.size > 0 ? 5_000 : NORMAL_POLL_MS / 2,
  });

  const unpairedQ = useQuery({
    queryKey: ["unpaired"],
    queryFn: () => unpairedApi.list(),
    refetchInterval: 30_000,
  });

  // WS: subscribe * so we get all plc_update messages.
  useEffect(() => {
    const ws = new ReconnectingWs("*");
    wsRef.current = ws;
    const off = ws.onMessage((raw) => {
      const m = raw as {
        type: string;
        plc_id?: string;
        master_id?: string;
        payload?: Record<string, unknown>;
      };
      if (m.type !== "plc_update") return;
      // Invalidate relevant queries so React Query refetches.
      if (m.plc_id) {
        qc.invalidateQueries({ queryKey: ["plcs"] });
        qc.invalidateQueries({ queryKey: ["plc-snapshot", m.plc_id] });
      }
    });
    ws.start();
    return () => {
      off();
      ws.stop();
    };
  }, [qc]);

  // Force a normal-poll tick: every 60s, invalidate plcs so latest_snapshot
  // is refreshed for all PLCs.
  useEffect(() => {
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["plcs"] });
    }, NORMAL_POLL_MS);
    return () => clearInterval(t);
  }, [qc]);

  const onPair = async (plcId: string, gatewayId: string) => {
    try {
      await unpairedApi.pair(plcId, gatewayId);
      qc.invalidateQueries({ queryKey: ["unpaired"] });
      qc.invalidateQueries({ queryKey: ["plcs"] });
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(`Pair failed: ${(e as Error).message}`);
    }
  };

  const gateways: Gateway[] = gatewaysQ.data ?? [];
  const plcs: PLC[] = plcsQ.data ?? [];
  const unpaired: PLC[] = unpairedQ.data ?? [];
  const isLoading =
    gatewaysQ.isLoading || plcsQ.isLoading || unpairedQ.isLoading;

  // Group PLCs by gateway_id
  const plcsByGateway = useMemo(() => {
    const m = new Map<string, PLC[]>();
    for (const plc of plcs) {
      if (!m.has(plc.master_id)) m.set(plc.master_id, []);
      m.get(plc.master_id)!.push(plc);
    }
    return m;
  }, [plcs]);

  // Group warnings by target for quick lookup
  const warningsByTarget = useMemo(() => {
    const m = new Map<string, Warning[]>();
    for (const w of activeWarnings) {
      if (!m.has(w.target_id)) m.set(w.target_id, []);
      m.get(w.target_id)!.push(w);
    }
    return m;
  }, [activeWarnings]);

  // Count gateways that have any warning
  const gatewaysWithWarning = useMemo(() => {
    return new Set(
      activeWarnings
        .filter((w) => w.target_type === "gateway")
        .map((w) => w.target_id)
    );
  }, [activeWarnings]);

  const toggleExpand = (id: string) => {
    setExpandedGateways((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 16 }}>Gateways</h1>
        {realtimePlcIds.size > 0 && (
          <span
            style={{
              fontSize: 11,
              color: "var(--severity-warning)",
              fontWeight: 600,
            }}
          >
            ● {realtimePlcIds.size} PLC in realtime
          </span>
        )}
        <div className="spacer" style={{ flex: 1 }} />
        <TimeRangePicker
          from={range.from}
          to={range.to}
          onChange={(r) => setRange({ from: r.from, to: r.to })}
        />
      </div>

      {isLoading && <div className="empty">Loading gateways…</div>}

      {!isLoading && gateways.length === 0 && (
        <div className="empty">
          No gateways yet. Start a gateway (or simulator) and publish to{" "}
          <code>plc-system/&lt;master_id&gt;/status</code>.
        </div>
      )}

      {gateways.map((gw) => {
        const gwPlcs = plcsByGateway.get(gw.master_id) ?? [];
        const isExpanded =
          expandedGateways.has(gw.master_id) || gateways.length === 1;
        const gwWarnings = warningsByTarget.get(gw.master_id) ?? [];
        return (
          <div key={gw.master_id}>
            <GatewayCard
              gateway={gw}
              plcs={gwPlcs}
              warnings={gwWarnings}
              expanded={isExpanded}
              onToggleExpand={() => toggleExpand(gw.master_id)}
            />
            {isExpanded && (
              <div className="plc-folder">
                <div className="plc-folder-header">
                  <span
                    className={clsx("chevron", isExpanded && "open")}
                  >
                    ▶
                  </span>
                  <span>PLCs in this gateway</span>
                  <span className="count">{gwPlcs.length}</span>
                </div>
                <div className="plc-folder-body">
                  {gwPlcs.length === 0 && (
                    <div className="empty">No PLCs assigned.</div>
                  )}
                  {gwPlcs.map((plc) => (
                    <PLCCard
                      key={plc.plc_id}
                      plc={plc}
                      mode={realtimePlcIds.has(plc.plc_id) ? "realtime" : "normal"}
                      warnings={warningsByTarget.get(plc.plc_id) ?? []}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <UnpairedSection
        plcs={unpaired}
        gateways={gateways}
        onPair={onPair}
      />

      <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>
        Polling: {Math.round(NORMAL_POLL_MS / 1000)}s default. Auto-realtime
        when a PLC has an active warning. Updated:{" "}
        {new Date(now).toLocaleTimeString()}.
      </p>
    </div>
  );
}
