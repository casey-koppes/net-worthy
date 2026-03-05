"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function SettingsPage() {
  const { profile, pubkey } = useAuthStore();

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
          <CardContent>
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
