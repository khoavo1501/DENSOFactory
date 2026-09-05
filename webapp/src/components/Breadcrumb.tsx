import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <span
            key={i}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {c.to && !isLast ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <span className="crumb-current">{c.label}</span>
            )}
            {!isLast && (
              <ChevronRight className="crumb-sep" aria-hidden size={12} />
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {subtitle && <span className="page-subtitle">{subtitle}</span>}
      <span className="spacer" />
      {actions}
    </header>
  );
}
