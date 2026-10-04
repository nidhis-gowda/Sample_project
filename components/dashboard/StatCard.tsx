import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

const TONES: Record<Tone, { accent: string; icon: string }> = {
  brand: { accent: "bg-brand-500", icon: "bg-brand-50 text-brand-600" },
  success: { accent: "bg-success", icon: "bg-success-soft text-success-ink" },
  warning: { accent: "bg-warning", icon: "bg-warning-soft text-warning-ink" },
  danger: { accent: "bg-danger", icon: "bg-danger-soft text-danger-ink" },
  neutral: { accent: "bg-ink-400", icon: "bg-ink-100 text-ink-600" },
};

/** Compact KPI tile used across the dashboard and reporting screens. */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const styles = TONES[tone];

  return (
    <Card className="relative overflow-hidden p-5">
      <span className={cn("absolute inset-x-0 top-0 h-1", styles.accent)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-ink-900">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              styles.icon
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );
}