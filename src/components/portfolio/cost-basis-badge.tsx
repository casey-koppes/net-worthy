"use client";

import { cn } from "@/lib/utils";

interface CostBasisBadgeProps {
  currentValue: number;
  costBasis: number | null | undefined;
  size?: "sm" | "default";
  className?: string;
  showCostBasis?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Displays cost basis and gain/loss from current value
 * - Gain: green text
 * - Loss: red text
 */
export function CostBasisBadge({
  currentValue,
  costBasis,
  size = "default",
  className,
  showCostBasis = true,
}: CostBasisBadgeProps) {
  // Handle null/undefined cost basis
  if (costBasis === null || costBasis === undefined || costBasis === 0) {
    return null;
  }

  const gainLoss = currentValue - costBasis;
  const isGain = gainLoss > 0;
  const isLoss = gainLoss < 0;

  const colorClass = isGain
    ? "text-green-600"
    : isLoss
      ? "text-red-600"
      : "text-muted-foreground";

  const sign = isGain ? "+" : "";

  return (
    <div
      className={cn(
        "flex flex-col items-end",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      {showCostBasis && (
        <span className="text-muted-foreground">
          Cost: {formatCurrency(costBasis)}
        </span>
      )}
      <span className={cn("font-medium", colorClass)}>
        {sign}{formatCurrency(gainLoss)}
      </span>
    </div>
  );
}
