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
import { Landmark } from "lucide-react";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { PerformanceBadge } from "./performance-badge";
import { EditAssetForm, type EditableAsset } from "./edit-asset-form";
import { PlaidLinkButton } from "./plaid-link-button";

interface ManualLoanAccount {
  id: string;
  name: string;
  description: string | null;
  value: number;
  category: string;
}

interface PlaidLoanAccount {
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

function getLoanTypeLabel(subtype: string | null): string {
  if (!subtype) return "loan";
  const labels: Record<string, string> = {
    auto: "Auto Loan",
    business: "Business Loan",
    commercial: "Commercial Loan",
    construction: "Construction Loan",
    consumer: "Consumer Loan",
    "home equity": "Home Equity",
    loan: "Loan",
    mortgage: "Mortgage",
    student: "Student Loan",
    other: "Other Loan",
  };
  return labels[subtype.toLowerCase()] || subtype;
}

interface LoansListProps {
  onAddAccount?: () => void;
  refreshTrigger?: number;
  onTotalChange?: (total: number) => void;
}

export function LoansList({
  onAddAccount,
  refreshTrigger = 0,
  onTotalChange,
}: LoansListProps) {
  const { dbUserId } = useAuthStore();
  const { performance } = usePortfolioStore();
  const [manualLoanAccounts, setManualLoanAccounts] = useState<ManualLoanAccount[]>([]);
  const [plaidLoanAccounts, setPlaidLoanAccounts] = useState<PlaidLoanAccount[]>([]);
  const [editingAsset, setEditingAsset] = useState<EditableAsset | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

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

  const fetchPlaidLoanAccounts = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/plaid/accounts?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for loan accounts only
        const loanAccounts = (data.accounts || []).filter(
          (account: PlaidLoanAccount) => account.type === "loan"
        );
        setPlaidLoanAccounts(loanAccounts);
      }
    } catch (error) {
      console.error("Failed to fetch Plaid loan accounts:", error);
    }
  }, [dbUserId]);

  const fetchManualLoanAccounts = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for loan category and not an asset
        const loanAccounts = data.assets.filter(
          (asset: ManualLoanAccount & { isAsset: boolean }) =>
            asset.category === "loan" && !asset.isAsset
        );
        setManualLoanAccounts(loanAccounts);
      }
    } catch (error) {
      console.error("Failed to fetch manual loan accounts:", error);
    }
  }, [dbUserId]);

  useEffect(() => {
    fetchManualLoanAccounts();
    fetchPlaidLoanAccounts();
  }, [fetchManualLoanAccounts, fetchPlaidLoanAccounts, refreshTrigger, localRefresh]);

  const allAccounts = [
    ...plaidLoanAccounts.map((account) => ({
      id: account.id,
      type: account.type,
      subtype: account.subtype,
      name: account.name,
      balance: account.balance,
      currency: account.currency,
      isManual: false,
      institutionName: account.institutionName,
      institutionLogo: account.institutionLogo,
      mask: account.mask,
    })),
    ...manualLoanAccounts.map((account) => ({
      id: account.id,
      type: "loan",
      subtype: null as string | null,
      name: account.name,
      balance: account.value,
      currency: "USD",
      isManual: true,
      institutionName: account.description || undefined,
      institutionLogo: null as string | null,
      mask: null as string | null,
    })),
  ];

  useEffect(() => {
    const manualTotal = manualLoanAccounts.reduce((sum, item) => sum + item.value, 0);
    const plaidTotal = plaidLoanAccounts.reduce((sum, item) => sum + item.balance, 0);
    onTotalChange?.(manualTotal + plaidTotal);
  }, [manualLoanAccounts, plaidLoanAccounts, onTotalChange]);

  if (allAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
          <CardDescription>
            Track mortgages, student loans, auto loans, and other debt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No loan accounts added yet.
            </p>
            <div className="flex gap-2">
              <PlaidLinkButton onSuccess={onAddAccount}>
                Connect loan account
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
          <CardTitle>Loans</CardTitle>
          <CardDescription>
            {allAccounts.length} account{allAccounts.length !== 1 ? "s" : ""}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <PlaidLinkButton
            variant="outline"
            size="sm"
            onSuccess={onAddAccount}
          >
            Connect loan
          </PlaidLinkButton>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[...allAccounts].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).map((account) => (
            <div
              key={account.id}
              className={`flex items-center justify-between rounded-lg border p-3 ${account.isManual ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
              onDoubleClick={() => {
                if (account.isManual) {
                  const originalAccount = manualLoanAccounts.find((a) => a.id === account.id);
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
                    alt={account.institutionName || "Loan"}
                    className="w-8 h-8 rounded object-contain"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                    <Landmark className="w-4 h-4 text-muted-foreground" />
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
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {getLoanTypeLabel(account.subtype)}
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
          ))}
        </div>
      </CardContent>

      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Loan</DialogTitle>
            <DialogDescription>
              Update the details of this loan
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
