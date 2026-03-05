"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, PlaidLinkOptions } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onExit?: () => void;
  children?: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  children = "Connect Bank Account",
  variant = "default",
  size = "default",
  className,
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dbUserId } = useAuthStore();

  // Fetch link token on mount
  useEffect(() => {
    async function fetchLinkToken() {
      if (!dbUserId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/plaid/link-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: dbUserId }),
        });

        if (!response.ok) {
          throw new Error("Failed to create link token");
        }

        const data = await response.json();
        setLinkToken(data.linkToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize");
      } finally {
        setIsLoading(false);
      }
    }

    fetchLinkToken();
  }, [dbUserId]);

  const handleOnSuccess = useCallback(
    async (publicToken: string, metadata: unknown) => {
      try {
        // Exchange public token for access token
        const response = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publicToken,
            userId: dbUserId,
            metadata,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to exchange token");
        }

        onSuccess?.();
      } catch (err) {
        console.error("Failed to exchange token:", err);
        setError("Failed to connect account");
      }
    },
    [dbUserId, onSuccess]
  );

  const handleOnExit = useCallback(() => {
    onExit?.();
  }, [onExit]);

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: handleOnExit,
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready) {
      open();
    }
  };

  if (error) {
    return (
      <Button variant="destructive" disabled className={className}>
        {error}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={!ready || isLoading}
      className={className}
    >
      {isLoading ? "Loading..." : children}
    </Button>
  );
}
