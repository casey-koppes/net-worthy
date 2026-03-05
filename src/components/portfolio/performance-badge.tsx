"use client";

import { cn } from "@/lib/utils";

interface PerformanceBadgeProps {
  value: number | null | undefined;
  showIcon?: boolean;
  size?: "sm" | "default";
  className?: string;
  periodLabel?: string;
}

/**
 * Displays a performance percentage with up/down indicator
 * - Positive: green text with 🔺 (up triangle)
 * - Negative: red text with 🔻 (down triangle)
 * - Zero/null: muted text, no icon
 */
export function PerformanceBadge({
  value,
  showIcon = true,
  size = "default",
  className,
  periodLabel,
}: PerformanceBadgeProps) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return (
      <span className={cn("text-muted-foreground", size === "sm" ? "text-xs" : "text-sm", className)}>
        --
      </span>
    );
  }

  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  // Round to whole number
  const displayValue = Math.round(Math.abs(value));

  // Determine colors and icons
  const colorClass = isPositive
    ? "text-green-600"
    : isNegative
      ? "text-red-600"
      : "text-muted-foreground";

  const icon = isPositive ? "🔺" : isNegative ? "🔻" : "";
  const sign = isPositive ? "+" : isNegative ? "-" : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        colorClass,
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      {showIcon && icon && <span className="text-[0.7em]">{icon}</span>}
      <span>
        {sign}{displayValue}%
      </span>
      {periodLabel && (
        <span className="text-muted-foreground font-normal ml-1">
          ({periodLabel})
        </span>
      )}
    </span>
  );
}
