"use client";

import { cn } from "@/lib/utils";

interface PerformanceBadgeProps {
  value: number | null | undefined;
  dollarChange?: number | null;
  showIcon?: boolean;
  showDollarChange?: boolean;
  size?: "sm" | "default";
  className?: string;
  periodLabel?: string;
}

function formatDollarChange(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) {
    return `${(absAmount / 1000000).toFixed(2)}M`;
  } else if (absAmount >= 1000) {
    return `${(absAmount / 1000).toFixed(2)}K`;
  }
  return absAmount.toFixed(2);
}

/**
 * Displays a performance percentage with up/down indicator
 * - Positive: green text with ▲ (up triangle)
 * - Negative: red text with ▼ (down triangle)
 * - Zero/null: muted text, no icon
 *
 * Format: "11%▲" for positive, "5%▼" for negative
 * Optionally shows dollar change: "(+$1,234.56)" or "(-$567.89)"
 */
export function PerformanceBadge({
  value,
  dollarChange,
  showIcon = true,
  showDollarChange = true,
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

  // Round to one decimal place for more precision, remove trailing .0
  const displayValue = Math.abs(value).toFixed(1).replace(/\.0$/, "");

  // Determine colors and icons
  const colorClass = isPositive
    ? "text-green-600"
    : isNegative
      ? "text-red-600"
      : "text-muted-foreground";

  // Use proper triangle symbols as user requested
  const icon = isPositive ? "▲" : isNegative ? "▼" : "";

  // Format dollar change
  const dollarChangeDisplay =
    showDollarChange && dollarChange !== null && dollarChange !== undefined && dollarChange !== 0
      ? dollarChange > 0
        ? `(+$${formatDollarChange(dollarChange)})`
        : `(-$${formatDollarChange(Math.abs(dollarChange))})`
      : null;

  return (
    <span
      className={cn(
        "inline-flex flex-col items-end font-medium whitespace-nowrap",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      <span className={cn("inline-flex items-center", colorClass)}>
        <span>{displayValue}%</span>
        {showIcon && icon && <span>{icon}</span>}
        {periodLabel && (
          <span className="text-muted-foreground font-normal ml-1">
            ({periodLabel})
          </span>
        )}
      </span>
      {dollarChangeDisplay && (
        <span className={cn("text-xs", colorClass)}>
          {dollarChangeDisplay}
        </span>
      )}
    </span>
  );
}
