import { useState } from "react";
import clsx from "clsx";
import { QUICK_RANGES, type QuickRange, resolveRange, formatDateTime } from "@/utils/timeRange";

interface TimeRangePickerProps {
  from: number;
  to: number;
  onChange: (next: { from: number; to: number; label?: string }) => void;
}

export function TimeRangePicker({ from, to, onChange }: TimeRangePickerProps) {
  const [token, setToken] = useState<QuickRange>("1h");
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(formatDateTime(from));
  const [customTo, setCustomTo] = useState(formatDateTime(to));

  const onPickQuick = (r: QuickRange) => {
    setToken(r);
    setCustomOpen(false);
    if (r === "custom") return;
    const next = resolveRange(r);
    onChange({ from: next.from, to: next.to });
  };

  const onApplyCustom = () => {
    const fromTs = Math.floor(new Date(customFrom).getTime() / 1000);
    const toTs = Math.floor(new Date(customTo).getTime() / 1000);
    if (fromTs && toTs && fromTs < toTs) {
      onChange({ from: fromTs, to: toTs });
    }
  };

  return (
    <div className="time-range-picker">
      <div className="time-range-quick">
        {QUICK_RANGES.map((r) => (
          <button
            key={r}
            className={clsx("btn", "time-range-btn", token === r && "btn-primary")}
            onClick={() => onPickQuick(r)}
          >
            {r}
          </button>
        ))}
        <button
          className={clsx("btn", "time-range-btn", token === "custom" && "btn-primary")}
          onClick={() => onPickQuick("custom")}
        >
          Custom
        </button>
      </div>
      {customOpen && (
        <div className="time-range-custom">
          <input
            type="datetime-local"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <span>→</span>
          <input
            type="datetime-local"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
          />
          <button className="btn btn-primary" onClick={onApplyCustom}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
