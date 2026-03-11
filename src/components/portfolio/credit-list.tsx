"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { PerformanceBadge } from "./performance-badge";
import { EditAssetForm, type EditableAsset } from "./edit-asset-form";
import { PlaidLinkButton } from "./plaid-link-button";

interface ManualCreditAccount {
  id: string;
  name: string;
  description: string | null;
  value: number;
  category: string;
}

interface PlaidCreditAccount {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: number;
  availableBalance: number | null;
  limit: number | null;
  currency: string;
  category: string;
  isAsset: boolean;
  institutionName: string;
  institutionLogo: string | null;
  mask: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getUtilizationColor(utilization: number): string {
  if (utilization < 30) return "text-green-600";
  if (utilization < 70) return "text-yellow-600";
  return "text-red-600";
}

interface CreditListProps {
  onAddAccount?: () => void;
  onAddManualAccount?: () => void;
  refreshTrigger?: number;
  onTotalChange?: (total: number) => void;
}

export function CreditList({
  onAddAccount,
  onAddManualAccount,
  refreshTrigger = 0,
  onTotalChange,
}: CreditListProps) {
  const { dbUserId } = useAuthStore();
  const { performance } = usePortfolioStore();
  const [manualCreditAccounts, setManualCreditAccounts] = useState<ManualCreditAccount[]>([]);
  const [plaidCreditAccounts, setPlaidCreditAccounts] = useState<PlaidCreditAccount[]>([]);
  const [editingAsset, setEditingAsset] = useState<EditableAsset | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  // Helper to get performance for an item
  const getItemPerformance = (itemId: string): { percent: number | null; dollarChange: number | null } => {
    const item = performance?.items.find((i) => i.id === itemId);
    if (!item) return { percent: null, dollarChange: null };
    const dollarChange = item.startValue !== null ? item.currentValue - item.startValue : null;
    return { percent: item.changePercent, dollarChange };
  };

  const handleEditSuccess = () => {
    setEditingAsset(null);
    setLocalRefresh((prev) => prev + 1);
  };

  const fetchPlaidCreditAccounts = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/plaid/accounts?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for credit accounts only (not loans)
        const creditAccounts = (data.accounts || []).filter(
          (account: PlaidCreditAccount) => account.type === "credit"
        );
        setPlaidCreditAccounts(creditAccounts);
      }
    } catch (error) {
      console.error("Failed to fetch Plaid credit accounts:", error);
    }
  }, [dbUserId]);

  const fetchManualCreditAccounts = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for credit accounts only (category credit and not an asset)
        const creditAccounts = data.assets.filter(
          (asset: ManualCreditAccount & { isAsset: boolean }) =>
            asset.category === "credit" && !asset.isAsset
        );
        setManualCreditAccounts(creditAccounts);
      }
    } catch (error) {
      console.error("Failed to fetch manual credit accounts:", error);
    }
  }, [dbUserId]);

  useEffect(() => {
    fetchManualCreditAccounts();
    fetchPlaidCreditAccounts();
  }, [fetchManualCreditAccounts, fetchPlaidCreditAccounts, refreshTrigger, localRefresh]);

  // Combine Plaid and manual credit accounts
  const allAccounts = [
    ...plaidCreditAccounts.map((account) => ({
      id: account.id,
      type: account.subtype || account.type,
      name: account.name,
      balance: account.balance,
      limit: account.limit,
      currency: account.currency,
      isManual: false,
      institutionName: account.institutionName,
      institutionLogo: account.institutionLogo,
      mask: account.mask,
    })),
    ...manualCreditAccounts.map((account) => ({
      id: account.id,
      type: "credit",
      name: account.name,
      balance: account.value,
      limit: null as number | null,
      currency: "USD",
      isManual: true,
      institutionName: account.description || undefined,
      institutionLogo: null as string | null,
      mask: null as string | null,
    })),
  ];

  // Calculate and report total
  useEffect(() => {
    const manualTotal = manualCreditAccounts.reduce((sum, item) => sum + item.value, 0);
    const plaidTotal = plaidCreditAccounts.reduce((sum, item) => sum + item.balance, 0);
    onTotalChange?.(manualTotal + plaidTotal);
  }, [manualCreditAccounts, plaidCreditAccounts, onTotalChange]);

  if (allAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Cards</CardTitle>
          <CardDescription>
            Track your credit card balances and utilization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No credit card accounts added yet.
            </p>
            <div className="flex gap-2">
              <PlaidLinkButton onSuccess={onAddAccount}>
                Connect credit card
              </PlaidLinkButton>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Credit Cards</CardTitle>
          <CardDescription>
            {allAccounts.length} card{allAccounts.length !== 1 ? "s" : ""} - {formatCurrency(allAccounts.reduce((sum, acc) => sum + acc.balance, 0))} owed
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <PlaidLinkButton
            variant="outline"
            size="sm"
            onSuccess={onAddAccount}
          >
            Connect credit card
          </PlaidLinkButton>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[...allAccounts].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).map((account) => {
            const utilization = account.limit ? (account.balance / account.limit) * 100 : null;
            return (
              <div
                key={account.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${account.isManual ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                onDoubleClick={() => {
                  if (account.isManual) {
                    const originalAccount = manualCreditAccounts.find((a) => a.id === account.id);
                    if (originalAccount) {
                      setEditingAsset({
                        id: originalAccount.id,
                        name: originalAccount.name,
                        description: originalAccount.description,
                        value: originalAccount.value,
                        category: originalAccount.category,
                        isAsset: false,
                      });
                    }
                  }
                }}
                title={account.isManual ? "Double-click to edit" : undefined}
              >
                <div className="flex items-center gap-3">
                  {account.institutionLogo ? (
                    <img
                      src={`data:image/png;base64,${account.institutionLogo}`}
                      alt={account.institutionName || "Credit Card"}
                      className="w-8 h-8 rounded object-contain"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">{account.name}</span>
                    {account.institutionName && (
                      <span className="text-sm text-muted-foreground">
                        {account.institutionName}
                        {account.mask && ` ****${account.mask}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {utilization !== null && (
                    <div className="text-right text-sm">
                      <span className={getUtilizationColor(utilization)}>
                        {utilization.toFixed(0)}% used
                      </span>
                      <p className="text-xs text-muted-foreground">
                        of {formatCurrency(account.limit!)}
                      </p>
                    </div>
                  )}
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    {account.type}
                  </Badge>
                  <span className="font-semibold text-red-600">
                    -{formatCurrency(Math.abs(account.balance))}
                  </span>
                  <PerformanceBadge
                    value={getItemPerformance(account.id).percent}
                    dollarChange={getItemPerformance(account.id).dollarChange}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credit Account</DialogTitle>
            <DialogDescription>
              Update the details of this credit account
            </DialogDescription>
          </DialogHeader>
          {editingAsset && (
            <EditAssetForm
              asset={editingAsset}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingAsset(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
