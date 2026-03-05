"use client";

import { useState, useEffect, useCallback } from "react";
import { NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
import {
  getNDK,
  connectNDK,
  loginWithNip07,
  hasNip07Extension,
  logout as ndkLogout,
  getCurrentUser,
} from "./ndk";

// Hook to manage Nostr connection state
export function useNostrConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await connectNDK();
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  return { isConnected, isConnecting, error, reconnect: connect };
}

// Hook to manage Nostr login state
export function useNostrLogin() {
  const [user, setUser] = useState<NDKUser | null>(null);
  const [profile, setProfile] = useState<NDKUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExtension, setHasExtension] = useState(false);

  // Check for extension on mount
  useEffect(() => {
    setHasExtension(hasNip07Extension());
  }, []);

  // Try to restore session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          await currentUser.fetchProfile();
          setProfile(currentUser.profile || null);
        }
      } catch (err) {
        console.error("Failed to restore session:", err);
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const loggedInUser = await loginWithNip07();
      if (loggedInUser) {
        setUser(loggedInUser);
        await loggedInUser.fetchProfile();
        setProfile(loggedInUser.profile || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    ndkLogout();
    setUser(null);
    setProfile(null);
  }, []);

  return {
    user,
    profile,
    isLoading,
    isLoggingIn,
    isLoggedIn: !!user,
    error,
    hasExtension,
    login,
    logout,
  };
}

// Hook to fetch a user's profile by pubkey
export function useNostrProfile(pubkey: string | undefined) {
  const [profile, setProfile] = useState<NDKUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pubkey) {
      setProfile(null);
      return;
    }

    async function fetchProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const ndk = getNDK();
        const user = ndk.getUser({ pubkey });
        await user.fetchProfile();
        setProfile(user.profile || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch profile");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [pubkey]);

  return { profile, isLoading, error };
}
