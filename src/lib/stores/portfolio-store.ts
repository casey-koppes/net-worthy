"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  type PeriodPreset,
  type PeriodState,
  getPeriodState,
} from "@/lib/utils/period-utils";

interface Account {
  id: string;
  type: string;
  subtype?: string;
  name: string;
  balance: number;
  availableBalance?: number;
  limit?: number;
  currency: string;
  category: string;
  isAsset: boolean;
  isManual: boolean;
  isHidden: boolean;
  visibility: "private" | "friends" | "public";
  institutionName?: string;
  lastSynced?: Date;
}

interface CryptoWallet {
  id: string;
  chain: string;
  address: string;
  label?: string;
  balance: number;
  balanceUsd: number;
  tokens?: Array<{
    symbol: string;
    balance: number;
    balanceUsd: number;
  }>;
  isHidden: boolean;
  visibility: "private" | "friends" | "public";
  lastSynced?: Date;
}

interface ManualAsset {
  id: string;
  category: string;
  name: string;
  description?: string;
  value: number;
  purchasePrice?: number;
  purchaseDate?: Date;
  isAsset: boolean;
  isHidden: boolean;
  visibility: "private" | "friends" | "public";
}

interface PortfolioSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown: {
    bank: number;
    investment: number;
    crypto: number;
    realEstate: number;
    vehicle: number;
    other: number;
  };
  lastUpdated: Date;
}

interface PerformanceTotals {
  currentAssets: number;
  startAssets: number | null;
  assetsChange: number | null;
  currentLiabilities: number;
  startLiabilities: number | null;
  liabilitiesChange: number | null;
  currentNetWorth: number;
  startNetWorth: number | null;
  netWorthChange: number | null;
}

interface PerformanceItem {
  id: string;
  type: string;
  name: string;
  category: string;
  currentValue: number;
  startValue: number | null;
  changePercent: number | null;
  ticker?: string;
}

interface PerformanceData {
  totals: PerformanceTotals;
  items: PerformanceItem[];
}

interface PortfolioState {
  // Data
  accounts: Account[];
  cryptoWallets: CryptoWallet[];
  manualAssets: ManualAsset[];
  summary: PortfolioSummary | null;

  // Period and Performance
  period: PeriodState;
  performance: PerformanceData | null;
  isLoadingPerformance: boolean;

  // Status
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Actions
  setAccounts: (accounts: Account[]) => void;
  setCryptoWallets: (wallets: CryptoWallet[]) => void;
  setManualAssets: (assets: ManualAsset[]) => void;
  setSummary: (summary: PortfolioSummary) => void;
  setPeriod: (preset: PeriodPreset) => void;
  setCustomPeriod: (startDate: Date, endDate: Date) => void;
  setPerformance: (data: PerformanceData | null) => void;
  setLoadingPerformance: (loading: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  accounts: [] as Account[],
  cryptoWallets: [] as CryptoWallet[],
  manualAssets: [] as ManualAsset[],
  summary: null as PortfolioSummary | null,
  period: getPeriodState("30d"), // Default to 30 days
  performance: null as PerformanceData | null,
  isLoadingPerformance: false,
  isLoading: true,
  isSyncing: false,
  error: null as string | null,
};

export const usePortfolioStore = create<PortfolioState>()((set) => ({
  ...initialState,

  setAccounts: (accounts) => set({ accounts }),
  setCryptoWallets: (cryptoWallets) => set({ cryptoWallets }),
  setManualAssets: (manualAssets) => set({ manualAssets }),
  setSummary: (summary) => set({ summary }),
  setPeriod: (preset) => set({ period: getPeriodState(preset), performance: null }),
  setCustomPeriod: (startDate, endDate) =>
    set({
      period: { preset: "custom", startDate, endDate },
      performance: null,
    }),
  setPerformance: (performance) => set({ performance }),
  setLoadingPerformance: (isLoadingPerformance) => set({ isLoadingPerformance }),
  setLoading: (isLoading) => set({ isLoading }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));

// Selector hooks for computed values
export function useNetWorth() {
  return usePortfolioStore((state) => state.summary?.netWorth ?? 0);
}

export function useTotalAssets() {
  return usePortfolioStore((state) => state.summary?.totalAssets ?? 0);
}

export function useTotalLiabilities() {
  return usePortfolioStore((state) => state.summary?.totalLiabilities ?? 0);
}

export function useVisibleAccounts() {
  return usePortfolioStore(
    useShallow((state) => state.accounts.filter((a) => !a.isHidden))
  );
}

export function useVisibleWallets() {
  return usePortfolioStore(
    useShallow((state) => state.cryptoWallets.filter((w) => !w.isHidden))
  );
}

export function useVisibleAssets() {
  return usePortfolioStore(
    useShallow((state) => state.manualAssets.filter((a) => !a.isHidden))
  );
}

export function usePeriod() {
  return usePortfolioStore((state) => state.period);
}

export function usePerformance() {
  return usePortfolioStore((state) => state.performance);
}

export function usePerformanceForItem(itemId: string) {
  return usePortfolioStore((state) =>
    state.performance?.items.find((i) => i.id === itemId)?.changePercent ?? null
  );
}
