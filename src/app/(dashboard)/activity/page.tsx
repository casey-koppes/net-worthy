"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth-store";

interface Activity {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function getActionIcon(action: string): string {
  switch (action) {
    case "account_added":
    case "plaid_connected":
      return "+";
    case "account_removed":
    case "plaid_disconnected":
      return "-";
    case "balance_changed":
      return "$";
    case "wallet_added":
      return "W";
    case "wallet_removed":
      return "X";
    case "asset_added":
      return "A";
    case "asset_removed":
      return "R";
    case "settings_changed":
      return "S";
    case "follow_added":
      return "F";
    case "follow_removed":
      return "U";
    default:
      return "!";
  }
}

function getActionColor(action: string): string {
  if (action.includes("added") || action.includes("changed")) {
    return "bg-green-100 text-green-800";
  }
  if (action.includes("removed")) {
    return "bg-red-100 text-red-800";
  }
  return "bg-blue-100 text-blue-800";
}

function formatAction(action: string, metadata: Record<string, unknown> | null): string {
  const name = metadata?.name || metadata?.institutionName || "";

  switch (action) {
    case "account_added":
      return `Connected ${name || "a new account"}`;
    case "account_removed":
      return `Disconnected ${name || "an account"}`;
    case "plaid_connected":
      return `Connected ${name || "a financial institution"}${metadata?.accountsCount ? ` (${metadata.accountsCount} accounts)` : ""}`;
    case "plaid_disconnected":
      return `Disconnected ${name || "a financial institution"}${metadata?.accountsCount ? ` (${metadata.accountsCount} accounts)` : ""}`;
    case "balance_changed":
      return `Balance updated for ${name || "an account"}`;
    case "wallet_added":
      return `Added ${metadata?.chain || "crypto"} wallet${name ? `: ${name}` : ""}`;
    case "wallet_removed":
      return `Removed ${metadata?.chain || "crypto"} wallet`;
    case "asset_added":
      return `Added ${name || "a manual asset"}`;
    case "asset_removed":
      return `Removed ${name || "a manual asset"}`;
    case "settings_changed":
      return "Updated privacy settings";
    case "follow_added":
      return `Started following ${name || "a user"}`;
    case "follow_removed":
      return `Unfollowed ${name || "a user"}`;
    case "login":
      return "Logged in";
    case "portfolio_synced":
      return "Synced portfolio data";
    default:
      return action.replace(/_/g, " ");
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getValueChangeDisplay(metadata: Record<string, unknown> | null): {
  text: string;
  className: string;
} | null {
  if (!metadata) return null;

  // For balance_changed action
  if (metadata.valueChange !== undefined) {
    const change = metadata.valueChange as number;
    if (change === 0) return null;
    const isPositive = change > 0;
    return {
      text: `${isPositive ? "+" : ""}${formatCurrency(change)}`,
      className: isPositive ? "text-green-600" : "text-red-600",
    };
  }

  // For asset_added/wallet_added - show the value
  if (metadata.value !== undefined || metadata.balanceUsd !== undefined) {
    const value = (metadata.value || metadata.balanceUsd) as number;
    return {
      text: `+${formatCurrency(value)}`,
      className: "text-green-600",
    };
  }

  // For asset_removed/wallet_removed - show negative value
  if (metadata.value !== undefined && metadata.value) {
    return {
      text: `-${formatCurrency(metadata.value as number)}`,
      className: "text-red-600",
    };
  }

  return null;
}

export default function ActivityPage() {
  const { dbUserId } = useAuthStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (dbUserId) {
      fetchActivities();
    }
  }, [dbUserId]);

  async function fetchActivities() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/activity?userId=${dbUserId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Group activities by date
  const groupedActivities = activities.reduce(
    (groups, activity) => {
      const date = new Date(activity.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
      return groups;
    },
    {} as Record<string, Activity[]>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity</h1>
        <p className="text-muted-foreground">
          Track changes to your portfolio over time
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            A log of all changes to your connected accounts and assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No activity yet.</p>
              <p className="text-sm mt-2">
                Activity will appear here as you connect accounts and make changes.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([date, dateActivities]) => (
                <div key={date}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    {date === new Date().toDateString() ? "Today" : date}
                  </h4>
                  <div className="space-y-3">
                    {dateActivities.map((activity) => {
                      const valueChange = getValueChangeDisplay(
                        activity.metadata as Record<string, unknown>
                      );
                      return (
                        <div
                          key={activity.id}
                          className="flex items-center gap-4 rounded-lg border p-3"
                        >
                          <Badge
                            className={`h-10 w-10 flex items-center justify-center text-lg ${getActionColor(
                              activity.action
                            )}`}
                          >
                            {getActionIcon(activity.action)}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-medium">
                              {formatAction(
                                activity.action,
                                activity.metadata as Record<string, unknown>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatTimeAgo(activity.createdAt)}
                            </p>
                          </div>
                          {valueChange && (
                            <div className={`font-semibold ${valueChange.className}`}>
                              {valueChange.text}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
