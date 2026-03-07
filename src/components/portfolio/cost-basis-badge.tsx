"use client";

import { cn } from "@/lib/utils";

interface CostBasisBadgeProps {
  currentValue: number;
  costBasis: number | null | undefined;
  size?: "sm" | "default" | "xs";
  className?: string;
  showCostBasis?: boolean;
  inline?: boolean;
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
 * Displays cost basis gain/loss with percentage and dollar change
 * - Gain: green text with ▲
 * - Loss: red text with ▼
 * Format matches PerformanceBadge: "8.5%▲ (+$688.04K)"
 */
export function CostBasisBadge({
  currentValue,
  costBasis,
  size = "default",
  className,
  showCostBasis = false,
  inline = true,
}: CostBasisBadgeProps) {
  // Handle null/undefined cost basis
  if (costBasis === null || costBasis === undefined || costBasis === 0) {
    return null;
  }

  const gainLoss = currentValue - costBasis;
  const percentChange = costBasis > 0 ? ((gainLoss / costBasis) * 100) : 0;
  const isGain = gainLoss > 0;
  const isLoss = gainLoss < 0;

  const colorClass = isGain
    ? "text-green-600"
    : isLoss
      ? "text-red-600"
      : "text-muted-foreground";

  const icon = isGain ? "▲" : isLoss ? "▼" : "";
  const displayPercent = Math.abs(percentChange).toFixed(1).replace(/\.0$/, "");

  const dollarChangeDisplay = gainLoss !== 0
    ? gainLoss > 0
      ? `(+$${formatDollarChange(gainLoss)})`
      : `(-$${formatDollarChange(Math.abs(gainLoss))})`
    : null;

  const sizeClass = size === "xs" ? "text-[10px]" : size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-end font-medium whitespace-nowrap",
        inline ? "flex-row gap-1" : "flex-col",
        sizeClass,
        className
      )}
    >
      <span className={cn("inline-flex items-center", colorClass)}>
        <span>{displayPercent}%</span>
        {icon && <span>{icon}</span>}
      </span>
      {dollarChangeDisplay && (
        <span className={cn(size === "xs" ? "text-[10px]" : "text-xs", colorClass)}>
          {dollarChangeDisplay}
        </span>
      )}
    </span>
  );
}
