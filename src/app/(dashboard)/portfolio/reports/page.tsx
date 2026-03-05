"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { UnitsChart } from "@/components/charts/units-chart";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";

interface HistoryDataPoint {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

interface HistoryStats {
  currentNetWorth: number;
  startingNetWorth: number;
  change: number;
  changePercent: number;
  periodStart: string | null;
  periodEnd: string | null;
}

const PERIODS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const ASSET_COLORS = {
  bank: "#3b82f6",
  investment: "#22c55e",
  crypto: "#f59e0b",
  realEstate: "#8b5cf6",
  vehicle: "#ec4899",
  other: "#6b7280",
};

const LIABILITY_COLORS = {
  mortgage: "#ef4444",
  loan: "#f97316",
  credit: "#eab308",
  other: "#dc2626",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface LiabilityItem {
  id: string;
  category: string;
  name: string;
  value: number;
  isAsset: boolean;
}

interface UnitAsset {
  assetId: string;
  assetType: "crypto" | "investment";
  assetName: string;
  assetSymbol: string;
}

interface UnitSnapshot {
  date: string;
  units: number;
}

export default function ReportsPage() {
  const { dbUserId } = useAuthStore();
  const { summary } = usePortfolioStore();
  const [period, setPeriod] = useState("30d");
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [liabilities, setLiabilities] = useState<LiabilityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unitAssets, setUnitAssets] = useState<UnitAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [unitSnapshots, setUnitSnapshots] = useState<UnitSnapshot[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);

  useEffect(() => {
    if (dbUserId) {
      fetchHistory();
      fetchLiabilities();
      fetchUnitAssets();
    }
  }, [dbUserId, period]);

  useEffect(() => {
    if (dbUserId && selectedAssetId) {
      fetchUnitSnapshots(selectedAssetId);
    }
  }, [dbUserId, selectedAssetId]);

  async function fetchHistory() {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/portfolio/history?userId=${dbUserId}&period=${period}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchLiabilities() {
    try {
      const res = await fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`);
      if (res.ok) {
        const data = await res.json();
        const liabilityItems = (data.assets || []).filter(
          (asset: LiabilityItem) => !asset.isAsset
        );
        setLiabilities(liabilityItems);
      }
    } catch (error) {
      console.error("Failed to fetch liabilities:", error);
    }
  }

  async function fetchUnitAssets() {
    try {
      const res = await fetch(`/api/portfolio/unit-snapshots?userId=${dbUserId}`);
      if (res.ok) {
        const data = await res.json();
        const assets = data.assets || [];
        setUnitAssets(assets);
        // Set default selected asset if available and not already set
        if (assets.length > 0 && !selectedAssetId) {
          setSelectedAssetId(assets[0].assetId);
        }
      }
    } catch (error) {
      console.error("Failed to fetch unit assets:", error);
    }
  }

  async function fetchUnitSnapshots(assetId: string) {
    setIsLoadingUnits(true);
    try {
      const res = await fetch(
        `/api/portfolio/unit-snapshots?userId=${dbUserId}&assetId=${assetId}`
      );
      if (res.ok) {
        const data = await res.json();
        setUnitSnapshots(data.snapshots || []);
      }
    } catch (error) {
      console.error("Failed to fetch unit snapshots:", error);
    } finally {
      setIsLoadingUnits(false);
    }
  }

  // Prepare asset allocation data
  const assetAllocationData = summary?.breakdown
    ? [
        { name: "Bank", value: summary.breakdown.bank, color: ASSET_COLORS.bank },
        {
          name: "Investments",
          value: summary.breakdown.investment,
          color: ASSET_COLORS.investment,
        },
        { name: "Crypto", value: summary.breakdown.crypto, color: ASSET_COLORS.crypto },
        {
          name: "Real Estate",
          value: summary.breakdown.realEstate,
          color: ASSET_COLORS.realEstate,
        },
        { name: "Vehicles", value: summary.breakdown.vehicle, color: ASSET_COLORS.vehicle },
        { name: "Other", value: summary.breakdown.other, color: ASSET_COLORS.other },
      ]
    : [];

  // Prepare liability allocation data - group by category
  const liabilityByCategory = liabilities.reduce((acc, item) => {
    const category = item.category || "other";
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += item.value;
    return acc;
  }, {} as Record<string, number>);

  const categoryLabels: Record<string, string> = {
    bank: "Bank Debt",
    investment: "Investment Debt",
    real_estate: "Mortgage",
    vehicle: "Auto Loan",
    other: "Other Debt",
  };

  const liabilityAllocationData = Object.entries(liabilityByCategory).map(([category, value]) => ({
    name: categoryLabels[category] || category.replace("_", " "),
    value,
    color: category === "real_estate" ? LIABILITY_COLORS.mortgage :
           category === "vehicle" ? LIABILITY_COLORS.loan :
           category === "bank" ? LIABILITY_COLORS.credit :
           LIABILITY_COLORS.other,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Reports</h1>
          <p className="text-muted-foreground">
            Track your net worth over time
          </p>
        </div>
        <Button variant="outline" onClick={fetchHistory}>
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Net Worth</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.currentNetWorth)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Change ({period})</CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  stats.change >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {stats.change >= 0 ? "+" : ""}
                {formatCurrency(stats.change)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Percent Change</CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  stats.changePercent >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {stats.changePercent >= 0 ? "+" : ""}
                {stats.changePercent.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Net Worth History Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Net Worth Over Time</CardTitle>
              <CardDescription>
                Track how your portfolio has grown
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <Button
                  key={p.value}
                  variant={period === p.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 animate-pulse bg-muted rounded" />
          ) : (
            <NetWorthChart data={history} />
          )}
        </CardContent>
      </Card>

      {/* Asset & Liability Allocation Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Asset Allocation Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <CardDescription>
              How your assets are distributed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationChart data={assetAllocationData} />
            <div className="space-y-3 mt-6">
              {assetAllocationData
                .filter((item) => item.value > 0)
                .sort((a, b) => b.value - a.value)
                .map((item) => {
                  const total = assetAllocationData.reduce((sum, i) => sum + i.value, 0);
                  const percent = total > 0 ? (item.value / total) * 100 : 0;

                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{formatCurrency(item.value)}</p>
                        <p className="text-xs text-muted-foreground">
                          {percent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Liability Allocation Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Liability Allocation</CardTitle>
            <CardDescription>
              How your debts are distributed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationChart data={liabilityAllocationData} />
            <div className="space-y-3 mt-6">
              {liabilityAllocationData
                .filter((item) => item.value > 0)
                .sort((a, b) => b.value - a.value)
                .map((item) => {
                  const total = liabilityAllocationData.reduce((sum, i) => sum + i.value, 0);
                  const percent = total > 0 ? (item.value / total) * 100 : 0;

                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm text-red-600">{formatCurrency(item.value)}</p>
                        <p className="text-xs text-muted-foreground">
                          {percent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              {liabilityAllocationData.filter((item) => item.value > 0).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No liabilities recorded
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Units Accumulated Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Units Accumulated Over Time</CardTitle>
              <CardDescription>
                Track the number of units you hold for each asset
              </CardDescription>
            </div>
            {unitAssets.length > 0 && (
              <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent>
                  {unitAssets.map((asset) => (
                    <SelectItem key={asset.assetId} value={asset.assetId}>
                      {asset.assetName} ({asset.assetSymbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingUnits ? (
            <div className="h-64 animate-pulse bg-muted rounded" />
          ) : unitAssets.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>No asset unit history available yet. Add crypto wallets or investments to track units.</p>
            </div>
          ) : (
            <UnitsChart
              data={unitSnapshots}
              assetName={unitAssets.find((a) => a.assetId === selectedAssetId)?.assetName || ""}
              assetSymbol={unitAssets.find((a) => a.assetId === selectedAssetId)?.assetSymbol || ""}
              color={
                unitAssets.find((a) => a.assetId === selectedAssetId)?.assetType === "crypto"
                  ? "#f59e0b"
                  : "#22c55e"
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
