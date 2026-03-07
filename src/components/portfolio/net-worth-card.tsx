"use client";

import { useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { PeriodSelector } from "./period-selector";
import { PerformanceBadge } from "./performance-badge";
import { formatDateForApi, type PeriodPreset } from "@/lib/utils/period-utils";

interface NetWorthCardProps {
  manualAssetsTotal?: number;
  manualLiabilitiesTotal?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function NetWorthCard({
  manualAssetsTotal = 0,
  manualLiabilitiesTotal = 0,
}: NetWorthCardProps) {
  const {
    summary,
    isSyncing,
    period,
    performance,
    isLoadingPerformance,
    setPeriod,
    setCustomPeriod,
    setPerformance,
    setLoadingPerformance,
  } = usePortfolioStore();
  const { dbUserId } = useAuthStore();

  const baseAssets = summary?.totalAssets ?? 0;
  const baseLiabilities = summary?.totalLiabilities ?? 0;

  // Include manual assets and liabilities in totals
  const totalAssets = baseAssets + manualAssetsTotal;
  const totalLiabilities = baseLiabilities + manualLiabilitiesTotal;
  const netWorth = totalAssets - totalLiabilities;

  // Fetch performance data when period changes
  const fetchPerformance = useCallback(async () => {
    if (!dbUserId) return;

    setLoadingPerformance(true);
    try {
      const startDate = formatDateForApi(period.startDate);
      const response = await fetch(
        `/api/portfolio/performance?userId=${dbUserId}&startDate=${startDate}`
      );

      if (response.ok) {
        const data = await response.json();
        setPerformance(data);
      } else {
        setPerformance(null);
      }
    } catch (error) {
      console.error("Failed to fetch performance:", error);
      setPerformance(null);
    } finally {
      setLoadingPerformance(false);
    }
  }, [dbUserId, period.startDate, setPerformance, setLoadingPerformance]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const handlePeriodChange = (preset: PeriodPreset) => {
    setPeriod(preset);
  };

  const handleCustomDateChange = (startDate: Date, endDate: Date) => {
    setCustomPeriod(startDate, endDate);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-2xl">Net Worth</CardTitle>
          <CardDescription>Your total portfolio value</CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-1">
            <PeriodSelector
              value={period.preset}
              onChange={handlePeriodChange}
              onCustomDateChange={handleCustomDateChange}
            />
            <span className="text-xs text-muted-foreground">Performance Period</span>
          </div>
          {isSyncing && (
            <Badge variant="secondary" className="animate-pulse">
              Syncing...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-bold tracking-tight">
              {formatCurrency(netWorth)}
            </p>
            {!isLoadingPerformance && performance?.totals && (
              <PerformanceBadge
                value={performance.totals.netWorthChange}
                dollarChange={
                  performance.totals.currentNetWorth - (performance.totals.startNetWorth ?? 0)
                }
              />
            )}
            {isLoadingPerformance && (
              <span className="text-sm text-muted-foreground animate-pulse">
                Loading...
              </span>
            )}
          </div>

          <div className="flex justify-end">
            <div className="grid grid-cols-2 gap-8 mr-[50px]">
              <div className="space-y-1 text-right mr-[25px]">
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-xl font-semibold text-green-600">
                  {formatCurrency(totalAssets)}
                </p>
                {!isLoadingPerformance && performance?.totals && (
                  <PerformanceBadge
                    value={performance.totals.assetsChange}
                    dollarChange={
                      performance.totals.currentAssets - (performance.totals.startAssets ?? 0)
                    }
                    size="sm"
                    inline
                    className="[&_span]:!text-[#737373]"
                  />
                )}
              </div>
              <div className="space-y-1 text-right ml-[25px]">
                <p className="text-sm text-muted-foreground">Total Liabilities</p>
                <p className="text-xl font-semibold text-red-600">
                  {formatCurrency(totalLiabilities)}
                </p>
                {!isLoadingPerformance && performance?.totals && (
                  <PerformanceBadge
                    value={performance.totals.liabilitiesChange}
                    dollarChange={
                      performance.totals.currentLiabilities - (performance.totals.startLiabilities ?? 0)
                    }
                    size="sm"
                    inline
                    className="[&_span]:!text-[#737373]"
                  />
                )}
              </div>
            </div>
          </div>

          {summary?.lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(summary.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
