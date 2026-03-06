"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

interface PlaidConnection {
  id: string;
  institutionName: string;
  status: "active" | "error" | "pending_reauth";
  accountCount: number;
}

export default function SettingsPage() {
  const { profile, pubkey, dbUserId } = useAuthStore();
  const [plaidConnections, setPlaidConnections] = useState<PlaidConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

  useEffect(() => {
    if (dbUserId) {
      fetchConnections();
    }
  }, [dbUserId]);

  async function fetchConnections() {
    try {
      const res = await fetch(`/api/plaid/connections?userId=${dbUserId}`);
      if (res.ok) {
        const data = await res.json();
        setPlaidConnections(data.connections || []);
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    } finally {
      setIsLoadingConnections(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your public profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Display Name</p>
              <p className="font-medium">{profile?.displayName || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">NIP-05</p>
              <p className="font-medium">{profile?.nip05 || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Public Key</p>
              <p className="font-mono text-xs break-all">{pubkey}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Edit your profile using your Nostr client (Damus, Primal, etc.)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Manage connected accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingConnections ? (
              <div className="animate-pulse space-y-2">
                <div className="h-10 bg-muted rounded" />
              </div>
            ) : plaidConnections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No bank accounts connected yet.
              </p>
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
                          {connection.accountCount} account{connection.accountCount !== 1 ? "s" : ""} connected
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
            <Button asChild>
              <Link href="/settings/integrations">Manage Integrations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
            <CardDescription>Control what others can see</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/privacy">Privacy Settings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Manage your subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/settings/billing">View Plans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
