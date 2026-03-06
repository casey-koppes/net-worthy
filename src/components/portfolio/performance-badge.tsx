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
 * - Positive: green text with ▲ (up triangle)
 * - Negative: red text with ▼ (down triangle)
 * - Zero/null: muted text, no icon
 *
 * Format: "11%▲" for positive, "5%▼" for negative
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

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium whitespace-nowrap",
        colorClass,
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      <span>{displayValue}%</span>
      {showIcon && icon && <span>{icon}</span>}
      {periodLabel && (
        <span className="text-muted-foreground font-normal ml-1">
          ({periodLabel})
        </span>
      )}
    </span>
  );
}
