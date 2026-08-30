import { useState, type ReactNode } from "react";
import clsx from "clsx";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  initial?: string;
  className?: string;
}

export function Tabs({ tabs, initial, className }: TabsProps) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={className}>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === active}
            className={clsx("tab", t.id === active && "active")}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
