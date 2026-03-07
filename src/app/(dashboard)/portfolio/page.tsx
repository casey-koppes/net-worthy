"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NetWorthCard } from "@/components/portfolio/net-worth-card";
import { AccountsList } from "@/components/portfolio/accounts-list";
import { CryptoWalletsList } from "@/components/portfolio/crypto-wallets-list";
import { ManualAssetsList } from "@/components/portfolio/manual-assets-list";
import { CreditList } from "@/components/portfolio/credit-list";
import { LoansList } from "@/components/portfolio/loans-list";
import { PlaidLinkButton } from "@/components/portfolio/plaid-link-button";
import { AddWalletForm } from "@/components/portfolio/add-wallet-form";
import { AddManualAssetForm } from "@/components/portfolio/add-manual-asset-form";
import { AddBankAccountForm } from "@/components/portfolio/add-bank-account-form";
import { AddInvestmentForm } from "@/components/portfolio/add-investment-form";
import { AddAssetForm } from "@/components/portfolio/add-asset-form";
import { InvestmentsList } from "@/components/portfolio/investments-list";
import { AssetsList } from "@/components/portfolio/assets-list";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { RefreshCw } from "lucide-react";

export default function PortfolioPage() {
  const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);
  const [isAddManualAssetOpen, setIsAddManualAssetOpen] = useState(false);
  const [isAddBankAccountOpen, setIsAddBankAccountOpen] = useState(false);
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] = useState(false);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [manualLiabilitiesTotal, setManualLiabilitiesTotal] = useState(0);
  const [creditTotal, setCreditTotal] = useState(0);
  const [loansTotal, setLoansTotal] = useState(0);
  const [investmentsTotal, setInvestmentsTotal] = useState(0);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [bankAccountsTotal, setBankAccountsTotal] = useState(0);
  const [cryptoTotal, setCryptoTotal] = useState(0);
  const { setSyncing } = usePortfolioStore();
  const { dbUserId } = useAuthStore();
  const snapshotSavedRef = useRef(false);

  // Save portfolio snapshot when totals are calculated
  useEffect(() => {
    const totalAssets = bankAccountsTotal + investmentsTotal + assetsTotal + cryptoTotal;
    const totalLiabilities = manualLiabilitiesTotal + creditTotal + loansTotal;
    const netWorth = totalAssets - totalLiabilities;

    // Only save if we have a user and some data (at least one total > 0)
    if (dbUserId && (totalAssets > 0 || totalLiabilities > 0) && !snapshotSavedRef.current) {
      snapshotSavedRef.current = true;

      // Debounce the save to avoid too many requests
      const timeoutId = setTimeout(() => {
        fetch("/api/portfolio/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: dbUserId,
            totalAssets,
            totalLiabilities,
            netWorth,
            breakdown: {
              bank: bankAccountsTotal,
              investment: investmentsTotal,
              crypto: cryptoTotal,
              realEstate: 0, // TODO: separate real estate from assets
              vehicle: 0, // TODO: separate vehicles from assets
              other: assetsTotal,
            },
          }),
        }).catch((err) => console.error("Failed to save snapshot:", err));
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [dbUserId, bankAccountsTotal, investmentsTotal, assetsTotal, cryptoTotal, manualLiabilitiesTotal, creditTotal, loansTotal]);

  // Reset snapshot saved flag when refresh is triggered
  useEffect(() => {
    snapshotSavedRef.current = false;
  }, [refreshTrigger]);

  const handleInvestmentsTotalChange = useCallback((total: number) => {
    setInvestmentsTotal(total);
  }, []);

  const handleAssetsTotalChange = useCallback((total: number) => {
    setAssetsTotal(total);
  }, []);

  const handleBankAccountsTotalChange = useCallback((total: number) => {
    setBankAccountsTotal(total);
  }, []);

  const handleLiabilityTotalChange = useCallback((total: number) => {
    setManualLiabilitiesTotal(total);
  }, []);

  const handleCreditTotalChange = useCallback((total: number) => {
    setCreditTotal(total);
  }, []);

  const handleLoansTotalChange = useCallback((total: number) => {
    setLoansTotal(total);
  }, []);

  const handleCryptoTotalChange = useCallback((total: number) => {
    setCryptoTotal(total);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await fetch("/api/portfolio/sync", { method: "POST" });
      // Refetch portfolio data
      await fetch("/api/portfolio/summary");
      // Trigger manual assets refresh
      triggerRefresh();
    } finally {
      setSyncing(false);
    }
  };

  const handlePlaidSuccess = () => {
    // Refresh portfolio after adding account
    handleRefresh();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">
            Track and manage your assets and liabilities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add to Portfolio</DialogTitle>
                <DialogDescription>
                  Choose what you want to add to your portfolio
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setIsAddBankAccountOpen(true)}
                >
                  Add Bank Account
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setIsAddInvestmentOpen(true)}
                >
                  Add Investment
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setIsAddAssetOpen(true)}
                >
                  Add Asset (Vehicle, Real Estate, Other)
                </Button>
                <PlaidLinkButton
                  onSuccess={handlePlaidSuccess}
                  className="w-full justify-start"
                  variant="outline"
                >
                  Connect Bank via Plaid
                </PlaidLinkButton>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setIsAddWalletOpen(true)}
                >
                  Add Crypto Wallet
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setIsAddManualAssetOpen(true)}
                >
                  Add Liability (Loan, Mortgage, etc.)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <NetWorthCard
        manualAssetsTotal={bankAccountsTotal + investmentsTotal + assetsTotal + cryptoTotal}
        manualLiabilitiesTotal={manualLiabilitiesTotal + creditTotal + loansTotal}
      />

      {/* Assets Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Assets</h2>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Assets</TabsTrigger>
            <TabsTrigger value="bank">Bank Accounts</TabsTrigger>
            <TabsTrigger value="investments">Investments</TabsTrigger>
            <TabsTrigger value="other">Other Assets</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <AccountsList
              onAddManualAccount={() => setIsAddBankAccountOpen(true)}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleBankAccountsTotalChange}
            />
            <InvestmentsList
              onAddInvestment={() => setIsAddInvestmentOpen(true)}
              onConnectBrokerage={handlePlaidSuccess}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleInvestmentsTotalChange}
            />
            <AssetsList
              onAddAsset={() => setIsAddAssetOpen(true)}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleAssetsTotalChange}
            />
            <CryptoWalletsList
              onAddWallet={() => setIsAddWalletOpen(true)}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleCryptoTotalChange}
            />
          </TabsContent>

          <TabsContent value="bank" className="space-y-6">
            <AccountsList
              onAddManualAccount={() => setIsAddBankAccountOpen(true)}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleBankAccountsTotalChange}
            />
          </TabsContent>

          <TabsContent value="investments" className="space-y-6">
            <InvestmentsList
              onAddInvestment={() => setIsAddInvestmentOpen(true)}
              onConnectBrokerage={handlePlaidSuccess}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleInvestmentsTotalChange}
            />
          </TabsContent>

          <TabsContent value="other" className="space-y-6">
            <AssetsList
              onAddAsset={() => setIsAddAssetOpen(true)}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleAssetsTotalChange}
            />
            <CryptoWalletsList
              onAddWallet={() => setIsAddWalletOpen(true)}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleCryptoTotalChange}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Liabilities Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Liabilities</h2>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Liabilities</TabsTrigger>
            <TabsTrigger value="credit">Credit</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="other">Other Liabilities</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <CreditList
              onAddAccount={handlePlaidSuccess}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleCreditTotalChange}
            />
            <LoansList
              onAddAccount={handlePlaidSuccess}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleLoansTotalChange}
            />
            <ManualAssetsList
              type="liabilities"
              onAddItem={() => setIsAddManualAssetOpen(true)}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleLiabilityTotalChange}
            />
          </TabsContent>

          <TabsContent value="credit" className="space-y-6">
            <CreditList
              onAddAccount={handlePlaidSuccess}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleCreditTotalChange}
            />
          </TabsContent>

          <TabsContent value="loans" className="space-y-6">
            <LoansList
              onAddAccount={handlePlaidSuccess}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleLoansTotalChange}
            />
          </TabsContent>

          <TabsContent value="other" className="space-y-6">
            <ManualAssetsList
              type="liabilities"
              onAddItem={() => setIsAddManualAssetOpen(true)}
              refreshTrigger={refreshTrigger}
              onTotalChange={handleLiabilityTotalChange}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Wallet Dialog */}
      <Dialog open={isAddWalletOpen} onOpenChange={setIsAddWalletOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Add Crypto Wallet</DialogTitle>
            <DialogDescription>
              Track your cryptocurrency holdings
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <AddWalletForm
              onSuccess={() => {
                setIsAddWalletOpen(false);
                handleRefresh();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Liability Dialog */}
      <Dialog open={isAddManualAssetOpen} onOpenChange={setIsAddManualAssetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Liability</DialogTitle>
            <DialogDescription>
              Add loans, mortgages, credit card debt, or other liabilities
            </DialogDescription>
          </DialogHeader>
          <AddManualAssetForm
            onSuccess={() => {
              setIsAddManualAssetOpen(false);
              triggerRefresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Asset Dialog */}
      <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
            <DialogDescription>
              Track vehicles, real estate, and other valuable assets
            </DialogDescription>
          </DialogHeader>
          <AddAssetForm
            onSuccess={() => {
              setIsAddAssetOpen(false);
              triggerRefresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Bank Account Dialog */}
      <Dialog open={isAddBankAccountOpen} onOpenChange={setIsAddBankAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
            <DialogDescription>
              Manually track a bank account balance
            </DialogDescription>
          </DialogHeader>
          <AddBankAccountForm
            onSuccess={() => {
              setIsAddBankAccountOpen(false);
              triggerRefresh();
            }}
            onConnectPlaid={() => {
              setIsAddBankAccountOpen(false);
              handlePlaidSuccess();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Investment Dialog */}
      <Dialog open={isAddInvestmentOpen} onOpenChange={setIsAddInvestmentOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Add Investment</DialogTitle>
            <DialogDescription>
              Track stocks, 401k, IRA, and other investments
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <AddInvestmentForm
              onSuccess={() => {
                setIsAddInvestmentOpen(false);
                triggerRefresh();
              }}
              onConnectPlaid={() => {
                setIsAddInvestmentOpen(false);
                handlePlaidSuccess();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
