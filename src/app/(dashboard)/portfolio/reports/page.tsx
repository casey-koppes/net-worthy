"use client";

import { useEffect, useState, useCallback } from "react";
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

interface PerformanceTotals {
  currentNetWorth: number;
  startNetWorth: number | null;
  netWorthChange: number | null;
  currentAssets: number;
  startAssets: number | null;
  assetsChange: number | null;
  currentLiabilities: number;
  startLiabilities: number | null;
  liabilitiesChange: number | null;
}

const PERIODS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

// Different shades of green for asset allocation
const ASSET_COLORS = {
  bank: "#166534",      // green-800
  investment: "#15803d", // green-700
  crypto: "#16a34a",     // green-600
  realEstate: "#22c55e", // green-500
  vehicle: "#4ade80",    // green-400
  other: "#86efac",      // green-300
};

// Different shades of red for liability allocation
const LIABILITY_COLORS = {
  mortgage: "#991b1b", // red-800 (darkest)
  loan: "#b91c1c",     // red-700
  credit: "#dc2626",   // red-600
  other: "#f87171",    // red-400 (lightest)
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ManualAssetItem {
  id: string;
  category: string;
  name: string;
  value: number;
  isAsset: boolean;
}

interface PlaidAccount {
  id: string;
  type: string;
  category: string;
  balance: number;
  isAsset: boolean;
}

interface CryptoWallet {
  id: string;
  balanceUsd: number;
  isHidden?: boolean;
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

interface AssetBreakdown {
  bank: number;
  investment: number;
  crypto: number;
  realEstate: number;
  vehicle: number;
  other: number;
}

interface LiabilityBreakdown {
  credit: number;
  loan: number;
  mortgage: number;
  other: number;
}

export default function ReportsPage() {
  const { dbUserId } = useAuthStore();
  const [period, setPeriod] = useState("30d");
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unitAssets, setUnitAssets] = useState<UnitAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [unitSnapshots, setUnitSnapshots] = useState<UnitSnapshot[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [performanceTotals, setPerformanceTotals] = useState<PerformanceTotals | null>(null);

  // Asset and liability breakdown state
  const [assetBreakdown, setAssetBreakdown] = useState<AssetBreakdown>({
    bank: 0,
    investment: 0,
    crypto: 0,
    realEstate: 0,
    vehicle: 0,
    other: 0,
  });
  const [liabilityBreakdown, setLiabilityBreakdown] = useState<LiabilityBreakdown>({
    credit: 0,
    loan: 0,
    mortgage: 0,
    other: 0,
  });

  const fetchAllPortfolioData = useCallback(async () => {
    if (!dbUserId) return;

    try {
      // Fetch all data in parallel
      const [manualAssetsRes, plaidAccountsRes, cryptoWalletsRes] = await Promise.all([
        fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`),
        fetch(`/api/plaid/accounts?userId=${dbUserId}`),
        fetch(`/api/crypto/wallets?userId=${dbUserId}`),
      ]);

      const newAssetBreakdown: AssetBreakdown = {
        bank: 0,
        investment: 0,
        crypto: 0,
        realEstate: 0,
        vehicle: 0,
        other: 0,
      };

      const newLiabilityBreakdown: LiabilityBreakdown = {
        credit: 0,
        loan: 0,
        mortgage: 0,
        other: 0,
      };

      // Process manual assets
      if (manualAssetsRes.ok) {
        const data = await manualAssetsRes.json();
        const assets = data.assets || [];

        for (const asset of assets as ManualAssetItem[]) {
          if (asset.isAsset) {
            // Assets
            switch (asset.category) {
              case "bank":
                newAssetBreakdown.bank += asset.value;
                break;
              case "investment":
                newAssetBreakdown.investment += asset.value;
                break;
              case "real_estate":
                newAssetBreakdown.realEstate += asset.value;
                break;
              case "vehicle":
                newAssetBreakdown.vehicle += asset.value;
                break;
              default:
                newAssetBreakdown.other += asset.value;
            }
          } else {
            // Liabilities
            switch (asset.category) {
              case "credit":
                newLiabilityBreakdown.credit += asset.value;
                break;
              case "loan":
                newLiabilityBreakdown.loan += asset.value;
                break;
              case "real_estate":
                newLiabilityBreakdown.mortgage += asset.value;
                break;
              default:
                newLiabilityBreakdown.other += asset.value;
            }
          }
        }
      }

      // Process Plaid accounts
      if (plaidAccountsRes.ok) {
        const data = await plaidAccountsRes.json();
        const accounts = data.accounts || [];

        for (const account of accounts as PlaidAccount[]) {
          if (account.isAsset) {
            // Assets
            if (account.category === "bank") {
              newAssetBreakdown.bank += account.balance;
            } else if (account.category === "investment") {
              newAssetBreakdown.investment += account.balance;
            }
          } else {
            // Liabilities
            if (account.type === "credit") {
              newLiabilityBreakdown.credit += account.balance;
            } else if (account.type === "loan") {
              // Check subtype for mortgage vs other loans
              newLiabilityBreakdown.loan += account.balance;
            }
          }
        }
      }

      // Process crypto wallets
      if (cryptoWalletsRes.ok) {
        const data = await cryptoWalletsRes.json();
        const wallets = data.wallets || [];

        for (const wallet of wallets as CryptoWallet[]) {
          if (!wallet.isHidden) {
            newAssetBreakdown.crypto += wallet.balanceUsd || 0;
          }
        }
      }

      setAssetBreakdown(newAssetBreakdown);
      setLiabilityBreakdown(newLiabilityBreakdown);
    } catch (error) {
      console.error("Failed to fetch portfolio data:", error);
    }
  }, [dbUserId]);

  // Convert period to startDate for performance API
  function getPerformanceStartDate(period: string): string {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000); // 5 years back
    }

    return startDate.toISOString().split("T")[0];
  }

  async function fetchPerformance() {
    try {
      const startDate = getPerformanceStartDate(period);
      const res = await fetch(
        `/api/portfolio/performance?userId=${dbUserId}&startDate=${startDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setPerformanceTotals(data.totals || null);
      }
    } catch (error) {
      console.error("Failed to fetch performance:", error);
    }
  }

  useEffect(() => {
    if (dbUserId) {
      fetchHistory();
      fetchAllPortfolioData();
      fetchUnitAssets();
      fetchPerformance();
    }
  }, [dbUserId, period, fetchAllPortfolioData]);

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

  // Prepare asset allocation data from fetched data
  const assetAllocationData = [
    { name: "Bank", value: assetBreakdown.bank, color: ASSET_COLORS.bank },
    { name: "Investments", value: assetBreakdown.investment, color: ASSET_COLORS.investment },
    { name: "Crypto", value: assetBreakdown.crypto, color: ASSET_COLORS.crypto },
    { name: "Real Estate", value: assetBreakdown.realEstate, color: ASSET_COLORS.realEstate },
    { name: "Vehicles", value: assetBreakdown.vehicle, color: ASSET_COLORS.vehicle },
    { name: "Other", value: assetBreakdown.other, color: ASSET_COLORS.other },
  ];

  // Prepare liability allocation data from fetched data
  const liabilityAllocationData = [
    { name: "Credit Cards", value: liabilityBreakdown.credit, color: LIABILITY_COLORS.credit },
    { name: "Loans", value: liabilityBreakdown.loan, color: LIABILITY_COLORS.loan },
    { name: "Mortgage", value: liabilityBreakdown.mortgage, color: LIABILITY_COLORS.mortgage },
    { name: "Other Debt", value: liabilityBreakdown.other, color: LIABILITY_COLORS.other },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Reports</h1>
          <p className="text-muted-foreground">
            Track your net worth over time
          </p>
        </div>
        <Button variant="outline" onClick={() => { fetchHistory(); fetchAllPortfolioData(); fetchPerformance(); }}>
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
              {performanceTotals ? (
                <p
                  className={`text-2xl font-bold ${
                    (performanceTotals.currentNetWorth - (performanceTotals.startNetWorth ?? 0)) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {(performanceTotals.currentNetWorth - (performanceTotals.startNetWorth ?? 0)) >= 0 ? "+" : ""}
                  {formatCurrency(performanceTotals.currentNetWorth - (performanceTotals.startNetWorth ?? 0))}
                </p>
              ) : (
                <p
                  className={`text-2xl font-bold ${
                    stats.change >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stats.change >= 0 ? "+" : ""}
                  {formatCurrency(stats.change)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Percent Change</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceTotals?.netWorthChange !== null && performanceTotals?.netWorthChange !== undefined ? (
                <p
                  className={`text-2xl font-bold ${
                    performanceTotals.netWorthChange >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {performanceTotals.netWorthChange >= 0 ? "+" : ""}
                  {performanceTotals.netWorthChange.toFixed(2)}%
                </p>
              ) : (
                <p
                  className={`text-2xl font-bold ${
                    stats.changePercent >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stats.changePercent >= 0 ? "+" : ""}
                  {stats.changePercent.toFixed(2)}%
                </p>
              )}
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
