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
import { Building2 } from "lucide-react";
import { useVisibleAccounts, usePortfolioStore } from "@/lib/stores/portfolio-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { PerformanceBadge } from "./performance-badge";
import { EditAssetForm, type EditableAsset } from "./edit-asset-form";
import { PlaidLinkButton } from "./plaid-link-button";

interface ManualBankAccount {
  id: string;
  name: string;
  description: string | null;
  value: number;
  category: string;
}

interface PlaidAccount {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: number;
  availableBalance: number | null;
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

function getAccountIcon(type: string): string {
  switch (type) {
    case "checking":
    case "savings":
      return "bank";
    case "investment":
    case "brokerage":
      return "chart";
    case "credit":
      return "card";
    case "loan":
    case "mortgage":
      return "loan";
    default:
      return "wallet";
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "bank":
      return "bg-blue-100 text-blue-800";
    case "investment":
      return "bg-green-100 text-green-800";
    case "crypto":
      return "bg-orange-100 text-orange-800";
    case "real_estate":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

interface AccountsListProps {
  onAddAccount?: () => void;
  onAddManualAccount?: () => void;
  refreshTrigger?: number;
  onTotalChange?: (total: number) => void;
}

export function AccountsList({
  onAddAccount,
  onAddManualAccount,
  refreshTrigger = 0,
  onTotalChange,
}: AccountsListProps) {
  const connectedAccounts = useVisibleAccounts();
  const { dbUserId } = useAuthStore();
  const { performance } = usePortfolioStore();
  const [manualBankAccounts, setManualBankAccounts] = useState<ManualBankAccount[]>([]);
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccount[]>([]);
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

  const fetchPlaidAccounts = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/plaid/accounts?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for bank category assets only (not investment, not loans)
        const bankAccounts = (data.accounts || []).filter(
          (account: PlaidAccount) => account.category === "bank" && account.isAsset
        );
        setPlaidAccounts(bankAccounts);
      }
    } catch (error) {
      console.error("Failed to fetch Plaid accounts:", error);
    }
  }, [dbUserId]);

  const fetchManualBankAccounts = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for bank accounts only
        const bankAccounts = data.assets.filter(
          (asset: ManualBankAccount & { isAsset: boolean }) =>
            asset.category === "bank" && asset.isAsset
        );
        setManualBankAccounts(bankAccounts);
      }
    } catch (error) {
      console.error("Failed to fetch manual bank accounts:", error);
    }
  }, [dbUserId]);

  useEffect(() => {
    fetchManualBankAccounts();
    fetchPlaidAccounts();
  }, [fetchManualBankAccounts, fetchPlaidAccounts, refreshTrigger, localRefresh]);

  // Combine connected accounts, Plaid accounts, and manual bank accounts
  const allAccounts = [
    ...connectedAccounts,
    ...plaidAccounts.map((account) => ({
      id: account.id,
      type: account.type,
      name: account.name,
      balance: account.balance,
      currency: account.currency,
      category: account.category,
      isAsset: account.isAsset,
      isManual: false,
      isHidden: false,
      visibility: "private" as const,
      institutionName: account.institutionName,
      institutionLogo: account.institutionLogo,
      mask: account.mask,
    })),
    ...manualBankAccounts.map((account) => ({
      id: account.id,
      type: "manual",
      name: account.name,
      balance: account.value,
      currency: "USD",
      category: "bank",
      isAsset: true,
      isManual: true,
      isHidden: false,
      visibility: "private" as const,
      institutionName: account.description || undefined,
    })),
  ];

  const accounts = allAccounts;

  // Calculate and report total
  useEffect(() => {
    const manualTotal = manualBankAccounts.reduce((sum, item) => sum + item.value, 0);
    const plaidTotal = plaidAccounts.reduce((sum, item) => sum + item.balance, 0);
    onTotalChange?.(manualTotal + plaidTotal);
  }, [manualBankAccounts, plaidAccounts, onTotalChange]);

  // Group accounts by category
  const groupedAccounts = accounts.reduce(
    (acc, account) => {
      const category = account.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(account);
      return acc;
    },
    {} as Record<string, typeof accounts>
  );

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bank Accounts</CardTitle>
          <CardDescription>
            Track your bank accounts and balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No bank accounts added yet.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onAddManualAccount}>
                Add Bank Account
              </Button>
              <PlaidLinkButton onSuccess={onAddAccount}>
                Connect bank account
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
          <CardTitle>Bank Accounts</CardTitle>
          <CardDescription>
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAddManualAccount}>
            Add Account
          </Button>
          <PlaidLinkButton
            variant="outline"
            size="sm"
            onSuccess={onAddAccount}
          >
            Connect bank account
          </PlaidLinkButton>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(groupedAccounts).map(([category, categoryAccounts]) => (
            <div key={category}>
              <h4 className="mb-3 text-sm font-medium capitalize text-muted-foreground">
                {category.replace("_", " ")}
              </h4>
              <div className="space-y-2">
                {[...categoryAccounts].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).map((account) => {
                  const isManual = "isManual" in account && account.isManual;
                  return (
                  <div
                    key={account.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${isManual ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                    onDoubleClick={() => {
                      if (isManual) {
                        // Find the original manual account data
                        const originalAccount = manualBankAccounts.find((a) => a.id === account.id);
                        if (originalAccount) {
                          setEditingAsset({
                            id: originalAccount.id,
                            name: originalAccount.name,
                            description: originalAccount.description,
                            value: originalAccount.value,
                            category: originalAccount.category,
                            isAsset: true,
                          });
                        }
                      }
                    }}
                    title={isManual ? "Double-click to edit" : undefined}
                  >
                    <div className="flex items-center gap-3">
                      {"institutionLogo" in account && account.institutionLogo ? (
                        <img
                          src={`data:image/png;base64,${account.institutionLogo}`}
                          alt={account.institutionName || "Bank"}
                          className="w-8 h-8 rounded object-contain"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium">{account.name}</span>
                        {account.institutionName && (
                          <span className="text-sm text-muted-foreground">
                            {account.institutionName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={getCategoryColor(account.category)}
                      >
                        {account.type}
                      </Badge>
                      <span
                        className={`font-semibold ${
                          account.isAsset ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {account.isAsset ? "" : "-"}
                        {formatCurrency(Math.abs(account.balance))}
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
            </div>
          ))}
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank Account</DialogTitle>
            <DialogDescription>
              Update the details of this bank account
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
