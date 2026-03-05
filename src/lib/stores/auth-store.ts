"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";

interface DbUser {
  id: string;
  email?: string;
  displayName?: string;
  nostrPubkey?: string;
  profileImage?: string;
}

interface AuthState {
  // Nostr user data (for Nostr login)
  user: NDKUser | null;
  profile: NDKUserProfile | null;
  pubkey: string | null;

  // Database user (for both email and Nostr login)
  dbUserId: string | null;
  dbUser: DbUser | null;

  // Status
  isLoading: boolean;
  isLoggedIn: boolean;

  // Actions
  setUser: (user: NDKUser | null, profile?: NDKUserProfile | null) => void;
  setDbUserId: (userId: string | null) => void;
  setDbUser: (user: DbUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      profile: null,
      pubkey: null,
      dbUserId: null,
      dbUser: null,
      isLoading: true,
      isLoggedIn: false,

      // Actions
      setUser: (user, profile = null) =>
        set({
          user,
          profile,
          pubkey: user?.pubkey || null,
          isLoggedIn: !!user || !!get().dbUserId,
          isLoading: false,
        }),

      setDbUserId: (userId) =>
        set({
          dbUserId: userId,
          isLoggedIn: !!userId || !!get().user,
          isLoading: false,
        }),

      setDbUser: (user) =>
        set({
          dbUser: user,
          dbUserId: user?.id || null,
          isLoggedIn: !!user,
          isLoading: false,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      logout: async () => {
        // Call logout API to clear session cookie
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch (error) {
          console.error("Logout API error:", error);
        }

        set({
          user: null,
          profile: null,
          pubkey: null,
          dbUserId: null,
          dbUser: null,
          isLoggedIn: false,
          isLoading: false,
        });
      },
    }),
    {
      name: "net-worthy-auth",
      partialize: (state) => ({
        pubkey: state.pubkey,
        dbUserId: state.dbUserId,
        dbUser: state.dbUser,
      }),
    }
  )
);
