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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlaidLinkButton } from "@/components/portfolio/plaid-link-button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

interface PlaidConnection {
  id: string;
  institutionName: string;
  status: "active" | "error" | "pending_reauth";
  accountCount: number;
  lastSynced: string;
}

interface CryptoWallet {
  id: string;
  chain: string;
  address: string;
  label: string | null;
  lastSynced: string;
}

export default function IntegrationsPage() {
  const { dbUserId } = useAuthStore();
  const [plaidConnections, setPlaidConnections] = useState<PlaidConnection[]>([]);
  const [cryptoWallets, setCryptoWallets] = useState<CryptoWallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (dbUserId) {
      fetchConnections();
    }
  }, [dbUserId]);

  async function fetchConnections() {
    setIsLoading(true);
    try {
      const [plaidRes, cryptoRes] = await Promise.all([
        fetch(`/api/plaid/connections?userId=${dbUserId}`),
        fetch(`/api/crypto/wallets?userId=${dbUserId}`),
      ]);

      if (plaidRes.ok) {
        const data = await plaidRes.json();
        setPlaidConnections(data.connections || []);
      }

      if (cryptoRes.ok) {
        const data = await cryptoRes.json();
        setCryptoWallets(data.wallets || []);
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function disconnectPlaid(connectionId: string) {
    try {
      const res = await fetch(
        `/api/plaid/connections?connectionId=${connectionId}&userId=${dbUserId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast.success("Connection removed successfully");
        fetchConnections();
      } else {
        toast.error("Failed to remove connection");
      }
    } catch (error) {
      toast.error("Failed to remove connection");
    }
  }

  async function disconnectWallet(walletId: string) {
    try {
      const res = await fetch(
        `/api/crypto/wallets?walletId=${walletId}&userId=${dbUserId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast.success("Wallet removed successfully");
        fetchConnections();
      } else {
        toast.error("Failed to remove wallet");
      }
    } catch (error) {
      toast.error("Failed to remove wallet");
    }
  }

  async function syncConnection(connectionId: string) {
    try {
      toast.info("Syncing accounts...");
      const res = await fetch(`/api/plaid/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, userId: dbUserId }),
      });

      if (res.ok) {
        toast.success("Accounts synced successfully");
        fetchConnections();
      } else {
        toast.error("Failed to sync accounts");
      }
    } catch (error) {
      toast.error("Failed to sync accounts");
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "pending_reauth":
        return <Badge className="bg-yellow-100 text-yellow-800">Needs Reauth</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function shortenAddress(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Manage Integrations</h1>
          <p className="text-muted-foreground">
            Connect and manage your financial accounts
          </p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manage Integrations</h1>
        <p className="text-muted-foreground">
          Connect and manage your financial accounts
        </p>
      </div>

      {/* Bank & Brokerage Connections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Bank & Brokerage Accounts</CardTitle>
            <CardDescription>
              Connect your bank accounts and investment accounts via Plaid
            </CardDescription>
          </div>
          <PlaidLinkButton onSuccess={fetchConnections} variant="outline" size="sm">
            Add Connection
          </PlaidLinkButton>
        </CardHeader>
        <CardContent>
          {plaidConnections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bank accounts connected yet.
            </div>
          ) : (
            <div className="space-y-3">
              {plaidConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{connection.institutionName}</p>
                      <p className="text-sm text-muted-foreground">
                        {connection.accountCount} account
                        {connection.accountCount !== 1 ? "s" : ""} connected
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(connection.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncConnection(connection.id)}
                    >
                      Sync
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the connection to {connection.institutionName}{" "}
                            and all associated account data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => disconnectPlaid(connection.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Crypto Wallets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Crypto Wallets</CardTitle>
            <CardDescription>
              Track your cryptocurrency holdings by public wallet address
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/portfolio">Add Wallet</a>
          </Button>
        </CardHeader>
        <CardContent>
          {cryptoWallets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No crypto wallets added yet.
            </div>
          ) : (
            <div className="space-y-3">
              {cryptoWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="uppercase">
                      {wallet.chain}
                    </Badge>
                    <div>
                      <p className="font-medium">
                        {wallet.label || shortenAddress(wallet.address)}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {shortenAddress(wallet.address)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Wallet?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the wallet and its balance from your portfolio.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => disconnectWallet(wallet.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
