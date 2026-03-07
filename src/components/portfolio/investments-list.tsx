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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, ExternalLink, PieChart, X, Plus, Minus } from "lucide-react";
import { InvestmentNews } from "./investment-news";
import { InvestmentInsights } from "./investment-insights";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";
import { getPeriodLabel } from "@/lib/utils/period-utils";
import { PerformanceBadge } from "./performance-badge";
import { CostBasisBadge } from "./cost-basis-badge";
import { EditAssetForm, type EditableAsset } from "./edit-asset-form";

interface Investment {
  id: string;
  name: string;
  description: string | null;
  value: number;
  purchasePrice: number | null;
  category: string;
  isAsset: boolean;
  createdAt?: string;
  metadata?: {
    action?: string;
    investmentType?: string;
    ticker?: string;
    shares?: number;
    pricePerShare?: number;
    purchasePrice?: number;
  };
}


interface GroupedInvestment {
  name: string;
  totalValue: number;
  totalShares: number;
  totalCostBasis: number | null;
  items: Investment[];
  ticker: string | null;
}

const categoryLabels: Record<string, string> = {
  stock: "Stock",
  "401k": "401(k)",
  roth: "Roth IRA",
  ira: "Traditional IRA",
  etf: "ETF",
  mutual_fund: "Mutual Fund",
  other: "Other",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "stock":
      return "bg-green-100 text-green-800";
    case "401k":
      return "bg-blue-100 text-blue-800";
    case "roth":
      return "bg-purple-100 text-purple-800";
    case "ira":
      return "bg-indigo-100 text-indigo-800";
    case "etf":
      return "bg-orange-100 text-orange-800";
    case "mutual_fund":
      return "bg-teal-100 text-teal-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Map tickers to their exchange for Google Finance URLs
const TICKER_EXCHANGES: Record<string, string> = {
  // NASDAQ stocks
  AAPL: "NASDAQ", MSFT: "NASDAQ", GOOGL: "NASDAQ", GOOG: "NASDAQ", AMZN: "NASDAQ",
  META: "NASDAQ", NVDA: "NASDAQ", TSLA: "NASDAQ", AMD: "NASDAQ", INTC: "NASDAQ",
  NFLX: "NASDAQ", PYPL: "NASDAQ", ADBE: "NASDAQ", CSCO: "NASDAQ", CMCSA: "NASDAQ",
  PEP: "NASDAQ", COST: "NASDAQ", AVGO: "NASDAQ", TXN: "NASDAQ", QCOM: "NASDAQ",
  SBUX: "NASDAQ", MDLZ: "NASDAQ", GILD: "NASDAQ", ISRG: "NASDAQ", VRTX: "NASDAQ",
  REGN: "NASDAQ", ATVI: "NASDAQ", BKNG: "NASDAQ", FISV: "NASDAQ", ADP: "NASDAQ",
  LRCX: "NASDAQ", KLAC: "NASDAQ", MCHP: "NASDAQ", SNPS: "NASDAQ", CDNS: "NASDAQ",
  ORLY: "NASDAQ", MNST: "NASDAQ", CTAS: "NASDAQ", PCAR: "NASDAQ", PAYX: "NASDAQ",
  ROST: "NASDAQ", ODFL: "NASDAQ", FAST: "NASDAQ", DXCM: "NASDAQ", IDXX: "NASDAQ",
  ZM: "NASDAQ", DOCU: "NASDAQ", SNOW: "NASDAQ", PLTR: "NASDAQ", COIN: "NASDAQ",
  RBLX: "NASDAQ", NET: "NASDAQ", DDOG: "NASDAQ", MDB: "NASDAQ", CRWD: "NASDAQ",
  OKTA: "NASDAQ", TWLO: "NASDAQ", ZS: "NASDAQ", TEAM: "NASDAQ", WDAY: "NASDAQ",
  SPLK: "NASDAQ", FTNT: "NASDAQ", PANW: "NASDAQ", ABNB: "NASDAQ", UBER: "NASDAQ",
  LYFT: "NASDAQ", DASH: "NASDAQ", RIVN: "NASDAQ", LCID: "NASDAQ", MARA: "NASDAQ",
  RIOT: "NASDAQ", MSTR: "NASDAQ", HOOD: "NASDAQ", SOFI: "NASDAQ", AFRM: "NASDAQ",
  SQ: "NASDAQ", SHOP: "NASDAQ", SPOT: "NASDAQ", SNAP: "NASDAQ", PINS: "NASDAQ",
  U: "NASDAQ", ROKU: "NASDAQ", TTD: "NASDAQ", MTCH: "NASDAQ", ETSY: "NASDAQ",
  DKNG: "NASDAQ", PENN: "NASDAQ", EA: "NASDAQ", WBD: "NASDAQ", NXPI: "NASDAQ",
  MRVL: "NASDAQ", ON: "NASDAQ", SWKS: "NASDAQ", ALGN: "NASDAQ", ILMN: "NASDAQ",
  BIIB: "NASDAQ", MRNA: "NASDAQ", SGEN: "NASDAQ", EXAS: "NASDAQ", ENPH: "NASDAQ",
  SEDG: "NASDAQ", FSLR: "NASDAQ", JD: "NASDAQ", PDD: "NASDAQ", BIDU: "NASDAQ",
  NTES: "NASDAQ", TCOM: "NASDAQ", BILI: "NASDAQ", STRC: "NASDAQ",

  // NYSE stocks
  JPM: "NYSE", BAC: "NYSE", WFC: "NYSE", GS: "NYSE", MS: "NYSE", C: "NYSE",
  V: "NYSE", MA: "NYSE", AXP: "NYSE", BLK: "NYSE", SCHW: "NYSE", USB: "NYSE",
  PNC: "NYSE", TFC: "NYSE", COF: "NYSE", DFS: "NYSE", SYF: "NYSE", AIG: "NYSE",
  MET: "NYSE", PRU: "NYSE", AFL: "NYSE", TRV: "NYSE", CB: "NYSE", ALL: "NYSE",
  WMT: "NYSE", TGT: "NYSE", HD: "NYSE", LOW: "NYSE", CVS: "NYSE", WBA: "NYSE",
  KR: "NYSE", DG: "NYSE", DLTR: "NYSE", FIVE: "NYSE", TJX: "NYSE", M: "NYSE",
  JWN: "NYSE", KSS: "NYSE", GPS: "NYSE", BBY: "NYSE", GME: "NYSE", AMC: "NYSE",
  NKE: "NYSE", UA: "NYSE", LULU: "NYSE", VFC: "NYSE", PVH: "NYSE", RL: "NYSE",
  MCD: "NYSE", YUM: "NYSE", SBUX: "NYSE", DPZ: "NYSE", CMG: "NYSE", DRI: "NYSE",
  DIS: "NYSE", PARA: "NYSE", FOX: "NYSE", FOXA: "NYSE", NYT: "NYSE", NWS: "NYSE",
  JNJ: "NYSE", PFE: "NYSE", MRK: "NYSE", ABBV: "NYSE", BMY: "NYSE", LLY: "NYSE",
  AMGN: "NYSE", UNH: "NYSE", CI: "NYSE", HUM: "NYSE", CVS: "NYSE", MCK: "NYSE",
  CAH: "NYSE", ABC: "NYSE", COR: "NYSE", TMO: "NYSE", DHR: "NYSE", ABT: "NYSE",
  MDT: "NYSE", SYK: "NYSE", BDX: "NYSE", BSX: "NYSE", ZBH: "NYSE", EW: "NYSE",
  XOM: "NYSE", CVX: "NYSE", COP: "NYSE", EOG: "NYSE", SLB: "NYSE", HAL: "NYSE",
  OXY: "NYSE", PSX: "NYSE", VLO: "NYSE", MPC: "NYSE", PXD: "NYSE", DVN: "NYSE",
  FANG: "NYSE", HES: "NYSE", APA: "NYSE", MRO: "NYSE", KMI: "NYSE", WMB: "NYSE",
  OKE: "NYSE", ET: "NYSE", EPD: "NYSE", MPLX: "NYSE", PAA: "NYSE", ENB: "NYSE",
  CAT: "NYSE", DE: "NYSE", MMM: "NYSE", GE: "NYSE", HON: "NYSE", UPS: "NYSE",
  FDX: "NYSE", UNP: "NYSE", CSX: "NYSE", NSC: "NYSE", DAL: "NYSE", UAL: "NYSE",
  LUV: "NYSE", AAL: "NYSE", BA: "NYSE", LMT: "NYSE", NOC: "NYSE", RTX: "NYSE",
  GD: "NYSE", TXT: "NYSE", HII: "NYSE", IBM: "NYSE", ORCL: "NYSE", CRM: "NYSE",
  ACN: "NYSE", SAP: "NYSE", NOW: "NYSE", INTU: "NYSE", ADSK: "NYSE", ANSS: "NYSE",
  T: "NYSE", VZ: "NYSE", TMUS: "NYSE", CHTR: "NYSE", TWX: "NYSE", DISH: "NYSE",

  // ETFs - typically on NYSE Arca
  SPY: "NYSEARCA", VOO: "NYSEARCA", VTI: "NYSEARCA", IVV: "NYSEARCA", QQQ: "NASDAQ",
  DIA: "NYSEARCA", IWM: "NYSEARCA", EFA: "NYSEARCA", EEM: "NYSEARCA", VEA: "NYSEARCA",
  VWO: "NYSEARCA", AGG: "NYSEARCA", BND: "NYSEARCA", LQD: "NYSEARCA", HYG: "NYSEARCA",
  TLT: "NASDAQ", IEF: "NYSEARCA", SHY: "NYSEARCA", TIP: "NYSEARCA", GOVT: "NYSEARCA",
  GLD: "NYSEARCA", SLV: "NYSEARCA", IAU: "NYSEARCA", GDX: "NYSEARCA", GDXJ: "NYSEARCA",
  XLF: "NYSEARCA", XLK: "NYSEARCA", XLV: "NYSEARCA", XLE: "NYSEARCA", XLI: "NYSEARCA",
  XLP: "NYSEARCA", XLY: "NYSEARCA", XLU: "NYSEARCA", XLB: "NYSEARCA", XLRE: "NYSEARCA",
  VIG: "NYSEARCA", VYM: "NYSEARCA", SCHD: "NYSEARCA", DVY: "NYSEARCA", HDV: "NYSEARCA",
  VNQ: "NYSEARCA", IYR: "NYSEARCA", REM: "NYSEARCA", MORT: "NYSEARCA", VGT: "NYSEARCA",
  ARKK: "NYSEARCA", ARKG: "NYSEARCA", ARKW: "NYSEARCA", ARKF: "NYSEARCA", ARKQ: "NYSEARCA",
  VTV: "NYSEARCA", VUG: "NYSEARCA", ITOT: "NYSEARCA", IEFA: "NYSEARCA", IEMG: "NYSEARCA",
};

// Generate Google Finance URL for a ticker
function getGoogleFinanceUrl(ticker: string | null): string | null {
  if (!ticker) return null;
  const upperTicker = ticker.toUpperCase();
  const exchange = TICKER_EXCHANGES[upperTicker] || "NASDAQ"; // Default to NASDAQ
  return `https://www.google.com/finance/quote/${upperTicker}:${exchange}`;
}

// Map ticker symbols to Brandfetch brand IDs
function getBrandfetchId(ticker: string | null, name: string): string | null {
  if (!ticker && !name) return null;

  const tickerUpper = ticker?.toUpperCase() || "";
  const nameLower = name.toLowerCase();

  // Map popular tickers to Brandfetch brand IDs
  // Find IDs at: https://brandfetch.com/{company}
  const tickerToBrandId: Record<string, string> = {
    // Tech Giants
    AAPL: "apple.com",
    MSFT: "idchmboHEZ", // Microsoft
    GOOGL: "google.com",
    GOOG: "google.com",
    AMZN: "amazon.com",
    META: "meta.com",
    NVDA: "nvidia.com",
    TSLA: "tesla.com",
    AMD: "amd.com",
    INTC: "intel.com",
    IBM: "ibm.com",
    ORCL: "oracle.com",
    CRM: "idsNTDpdQb", // Salesforce
    ADBE: "adobe.com",
    NFLX: "netflix.com",
    PYPL: "paypal.com",
    SQ: "squareup.com",
    SHOP: "shopify.com",
    UBER: "uber.com",
    LYFT: "lyft.com",
    ABNB: "airbnb.com",
    SNAP: "snapchat.com",
    PINS: "pinterest.com",
    TWTR: "twitter.com",
    X: "x.com",
    SPOT: "spotify.com",
    ZM: "zoom.us",
    DOCU: "docusign.com",
    SNOW: "snowflake.com",
    PLTR: "palantir.com",
    COIN: "coinbase.com",
    RBLX: "roblox.com",
    U: "unity.com",
    NET: "cloudflare.com",
    DDOG: "datadoghq.com",
    MDB: "mongodb.com",
    CRWD: "crowdstrike.com",
    OKTA: "okta.com",
    TWLO: "idT7wVo_zL", // Twilio

    // Finance
    JPM: "jpmorgan.com",
    BAC: "bankofamerica.com",
    WFC: "wellsfargo.com",
    GS: "goldmansachs.com",
    MS: "morganstanley.com",
    C: "citigroup.com",
    AXP: "americanexpress.com",
    V: "visa.com",
    MA: "mastercard.com",
    BRK: "berkshirehathaway.com",
    SCHW: "schwab.com",
    BLK: "blackrock.com",

    // Retail
    WMT: "walmart.com",
    TGT: "target.com",
    COST: "costco.com",
    HD: "homedepot.com",
    LOW: "lowes.com",
    NKE: "nike.com",
    SBUX: "starbucks.com",
    MCD: "mcdonalds.com",
    DIS: "disney.com",

    // Healthcare
    JNJ: "jnj.com",
    PFE: "pfizer.com",
    MRNA: "modernatx.com",
    UNH: "unitedhealthgroup.com",
    CVS: "cvshealth.com",

    // Energy
    XOM: "exxonmobil.com",
    CVX: "chevron.com",

    // ETFs and Funds
    VOO: "vanguard.com",
    VTI: "vanguard.com",
    VIG: "vanguard.com",
    VYM: "vanguard.com",
    VNQ: "vanguard.com",
    VGT: "vanguard.com",
    VTV: "vanguard.com",
    VUG: "vanguard.com",
    SPY: "ssga.com",
    IVV: "blackrock.com",
    QQQ: "invesco.com",
    DIA: "ssga.com",
    IWM: "blackrock.com",
    EFA: "blackrock.com",
    EEM: "blackrock.com",
    GLD: "ssga.com",
    SLV: "blackrock.com",
    TLT: "blackrock.com",
    HYG: "blackrock.com",
    LQD: "blackrock.com",
    ARKK: "ark-funds.com",
    ARKG: "ark-funds.com",
    ARKW: "ark-funds.com",

    // Crypto-related
    MSTR: "microstrategy.com",
    MARA: "mara.com",
    RIOT: "riotplatforms.com",
  };

  // Check ticker first
  if (tickerToBrandId[tickerUpper]) {
    return tickerToBrandId[tickerUpper];
  }

  // Check if name contains a company we know
  const namePatterns: Array<[string, string | null]> = [
    ["apple", "apple.com"],
    ["microsoft", "idchmboHEZ"],
    ["google", "google.com"],
    ["alphabet", "google.com"],
    ["amazon", "amazon.com"],
    ["meta", "meta.com"],
    ["facebook", "meta.com"],
    ["nvidia", "nvidia.com"],
    ["tesla", "tesla.com"],
    ["twilio", "idT7wVo_zL"],
    ["vanguard", "vanguard.com"],
    ["fidelity", "fidelity.com"],
    ["schwab", "schwab.com"],
    ["blackrock", "blackrock.com"],
    ["401", null], // Retirement accounts don't need logos
    ["ira", null],
    ["roth", null],
    ["retirement", null],
  ];

  for (const [pattern, brandId] of namePatterns) {
    if (nameLower.includes(pattern)) {
      return brandId;
    }
  }

  return null;
}

// Get logo URL from Brandfetch CDN
function getStockLogo(ticker: string | null, name: string): string | null {
  const brandId = getBrandfetchId(ticker, name);
  if (!brandId) return null;

  // Brandfetch CDN URL format
  return `https://cdn.brandfetch.io/${brandId}/w/400/h/400/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX`;
}

// Stock Logo component with fallback
function StockLogo({ ticker, name, size = "md" }: { ticker: string | null; name: string; size?: "sm" | "md" }) {
  const [imageError, setImageError] = useState(false);
  const logoUrl = getStockLogo(ticker, name);

  const fallbackInitials = (ticker || name.substring(0, 2)).toUpperCase().substring(0, 2);
  const sizeClasses = size === "sm" ? "w-4 h-4" : "w-8 h-8";
  const textSize = size === "sm" ? "text-[6px]" : "text-xs";

  if (!logoUrl || imageError) {
    return (
      <div className={`${sizeClasses} rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white ${textSize} font-bold`}>
        {fallbackInitials}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={ticker || name}
      className={`${sizeClasses} rounded-md object-contain bg-white`}
      onError={() => setImageError(true)}
    />
  );
}

// Extract ticker symbol and shares from description (e.g., "GLD - 100 shares")
function parseDescription(description: string | null): { ticker: string | null; shares: number } {
  if (!description) return { ticker: null, shares: 0 };

  const match = description.match(/^([A-Z]+)\s*-\s*(\d+(?:\.\d+)?)\s*shares?/i);
  if (match) {
    return { ticker: match[1].toUpperCase(), shares: parseFloat(match[2]) };
  }
  return { ticker: null, shares: 0 };
}

// Extract investment type from description
function getInvestmentType(description: string | null): string | null {
  if (!description) return null;
  for (const [key, label] of Object.entries(categoryLabels)) {
    if (description.toLowerCase().includes(key) || description.includes(label)) {
      return key;
    }
  }
  return null;
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


// Group investments by name
function groupInvestments(investments: Investment[]): GroupedInvestment[] {
  const groups = new Map<string, GroupedInvestment>();

  for (const investment of investments) {
    const key = investment.name.toLowerCase();
    const { ticker, shares } = parseDescription(investment.description);

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.totalValue += investment.value;
      group.totalShares += shares;
      if (investment.purchasePrice) {
        group.totalCostBasis = (group.totalCostBasis || 0) + investment.purchasePrice;
      }
      group.items.push(investment);
      if (ticker && !group.ticker) {
        group.ticker = ticker;
      }
    } else {
      groups.set(key, {
        name: investment.name,
        totalValue: investment.value,
        totalShares: shares,
        totalCostBasis: investment.purchasePrice,
        items: [investment],
        ticker,
      });
    }
  }

  // Sort items within each group by createdAt (newest first)
  for (const group of groups.values()) {
    group.items.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  }

  return Array.from(groups.values()).sort((a, b) => b.totalValue - a.totalValue);
}

interface InvestmentsListProps {
  onAddInvestment?: () => void;
  onConnectBrokerage?: () => void;
  refreshTrigger?: number;
  onTotalChange?: (total: number) => void;
}

export function InvestmentsList({
  onAddInvestment,
  onConnectBrokerage,
  refreshTrigger = 0,
  onTotalChange,
}: InvestmentsListProps) {
  const { dbUserId } = useAuthStore();
  const { performance, period } = usePortfolioStore();
  const periodLabel = getPeriodLabel(period.preset, period);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAsset, setEditingAsset] = useState<EditableAsset | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [activityFilters, setActivityFilters] = useState<Record<string, "all" | "buy" | "sell">>({});
  const [stockPrices, setStockPrices] = useState<Record<string, number>>({});

  // Helper to get performance for an item
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

  const toggleGroup = (name: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedGroups(newExpanded);
  };

  const getActivityFilter = (groupName: string) => activityFilters[groupName.toLowerCase()] || "all";

  const setActivityFilter = (groupName: string, filter: "all" | "buy" | "sell") => {
    setActivityFilters(prev => ({ ...prev, [groupName.toLowerCase()]: filter }));
  };

  const fetchInvestments = useCallback(async () => {
    if (!dbUserId) return;

    try {
      const response = await fetch(`/api/portfolio/manual-assets?userId=${dbUserId}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for investment category only
        const investmentItems = data.assets.filter(
          (asset: Investment & { isAsset: boolean }) => asset.category === "investment"
        );
        setInvestments(investmentItems);

        // Report total to parent
        const total = investmentItems
          .filter((i: Investment) => i.isAsset)
          .reduce((sum: number, item: Investment) => sum + item.value, 0);
        onTotalChange?.(total);
      }
    } catch (error) {
      console.error("Failed to fetch investments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dbUserId, onTotalChange]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments, refreshTrigger, localRefresh]);

  // Fetch stock prices for all unique tickers
  useEffect(() => {
    async function fetchStockPrices() {
      // Collect all unique tickers from investments
      const tickers = new Set<string>();
      for (const inv of investments) {
        const ticker = inv.metadata?.ticker || parseDescription(inv.description).ticker;
        if (ticker) tickers.add(ticker.toUpperCase());
      }

      // Fetch prices for each ticker
      const prices: Record<string, number> = {};
      for (const ticker of tickers) {
        try {
          const res = await fetch(`/api/stocks/quote?ticker=${ticker}`);
          if (res.ok) {
            const data = await res.json();
            prices[ticker] = data.price;
          }
        } catch (error) {
          console.error(`Failed to fetch price for ${ticker}:`, error);
        }
      }
      setStockPrices(prices);
    }

    if (investments.length > 0) {
      fetchStockPrices();
    }
  }, [investments]);

  const groupedInvestments = groupInvestments(investments);
  const total = investments
    .filter((i) => i.isAsset)
    .reduce((sum, item) => sum + item.value, 0);

  // Count unique groups for display
  const uniqueCount = groupedInvestments.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investments</CardTitle>
          <CardDescription>Track your investment portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (investments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Investments</CardTitle>
          <CardDescription>Track your investment portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No investments added yet.
            </p>
            <Button variant="outline" onClick={onAddInvestment}>
              Add Investment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Extract tickers for news component
  const tickers = groupedInvestments
    .map((g) => g.ticker)
    .filter((t): t is string => t !== null);

  // Prepare holdings data for insights
  const holdings = groupedInvestments.map((g) => ({
    name: g.name,
    ticker: g.ticker,
    value: g.totalValue,
    shares: g.totalShares,
    percentage: total > 0 ? (g.totalValue / total) * 100 : 0,
  }));

  // Pie chart data for Report
  const pieChartData = groupedInvestments.map((g, i) => ({
    name: g.ticker || g.name,
    value: g.totalValue,
    fill: [
      "hsl(210, 100%, 50%)",  // Blue
      "hsl(210, 100%, 60%)",  // Lighter blue
      "hsl(210, 100%, 70%)",  // Even lighter
      "hsl(210, 100%, 40%)",  // Darker blue
      "hsl(200, 100%, 50%)",  // Cyan-blue
      "hsl(220, 100%, 50%)",  // Purple-blue
      "hsl(210, 80%, 45%)",   // Muted blue
      "hsl(210, 90%, 55%)",   // Medium blue
    ][i % 8],
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Investments</CardTitle>
          <CardDescription>Track your investment portfolio</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAddInvestment}>
            Add Investment
          </Button>
          <Button
            variant={showReport ? "default" : "outline"}
            size="icon"
            onClick={() => setShowReport(!showReport)}
            title="View allocation report"
          >
            <PieChart className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`flex gap-4 ${showReport ? "flex-col lg:flex-row" : ""}`}>
          {/* Main Content */}
          <div className={showReport ? "flex-1 lg:w-2/3" : "w-full"}>
        <Tabs defaultValue="investments" className="w-full">
          {/* Chrome-style tabs */}
          <div className="border-b">
            <TabsList className="h-auto p-0 bg-transparent gap-0">
              <TabsTrigger
                value="investments"
                className="relative rounded-none rounded-t-lg border border-b-0 border-transparent data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2 text-sm font-medium data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground data-[state=active]:z-10 -mb-px"
              >
                {uniqueCount} investments - {formatCurrency(total)}
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="relative rounded-none rounded-t-lg border border-b-0 border-transparent data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2 text-sm font-medium data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground data-[state=active]:z-10 -mb-px -ml-px"
              >
                News
              </TabsTrigger>
              <TabsTrigger
                value="insights"
                className="relative rounded-none rounded-t-lg border border-b-0 border-transparent data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2 text-sm font-medium data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground data-[state=active]:z-10 -mb-px -ml-px"
              >
                Insights
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="investments" className="mt-4">
        <div className="space-y-2">
          {groupedInvestments.map((group) => {
            const isExpanded = expandedGroups.has(group.name.toLowerCase());
            const hasMultipleItems = group.items.length > 1;

            return (
              <div key={group.name} className="rounded-lg border overflow-hidden">
                {/* Main row - clickable to expand */}
                <div
                  className={`group flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? "bg-muted/30" : ""}`}
                  onClick={() => toggleGroup(group.name.toLowerCase())}
                >
                  <div className="flex items-center gap-3">
                    <StockLogo ticker={group.ticker} name={group.name} />
                    <div className="flex flex-col">
                      <span className="font-medium">{group.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">
                          {group.ticker || ""}{group.ticker && group.totalShares > 0 ? " - " : ""}
                          {group.totalShares > 0 ? `${group.totalShares} shares` : ""}
                        </span>
                        {group.ticker && (
                          <a
                            href={getGoogleFinanceUrl(group.ticker) || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                            title={`View ${group.ticker} on Google Finance`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {hasMultipleItems && (
                          <span className="ml-1 text-xs text-blue-600">
                            ({group.items.length} records)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-semibold">
                        {formatCurrency(group.totalValue)}
                      </span>
                      {group.totalCostBasis && (
                        <CostBasisBadge
                          currentValue={group.totalValue}
                          costBasis={group.totalCostBasis}
                          size="sm"
                        />
                      )}
                    </div>
                    <PerformanceBadge
                      value={getItemPerformance(group.items[0]?.id).percent}
                      dollarChange={getItemPerformance(group.items[0]?.id).dollarChange}
                      size="sm"
                    />
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t bg-muted/10 p-3 space-y-3">
                    {/* Activity Filter Toggle */}
                    <Tabs
                      value={getActivityFilter(group.name)}
                      onValueChange={(value) => setActivityFilter(group.name, value as "all" | "buy" | "sell")}
                      className="w-full"
                    >
                      <TabsList className="h-8">
                        <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
                        <TabsTrigger value="buy" className="text-xs px-3">Buy</TabsTrigger>
                        <TabsTrigger value="sell" className="text-xs px-3">Sell</TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Filtered Activity Records */}
                    <div className="space-y-2">
                      {group.items
                        .filter((item) => {
                          const filter = getActivityFilter(group.name);
                          if (filter === "all") return true;
                          const action = item.metadata?.action || "buy";
                          return action === filter;
                        })
                        .map((item) => {
                          const { shares } = parseDescription(item.description);
                          const action = item.metadata?.action || "buy";
                          const isBuy = action === "buy";
                          const displayShares = item.metadata?.shares || shares;

                          const { ticker } = parseDescription(item.description);
                          const displayTicker = item.metadata?.ticker || ticker;

                          return (
                            <div key={item.id} className="flex items-center gap-2">
                              {/* Icon outside the card */}
                              <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                                isBuy ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                              }`}>
                                {isBuy ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                              </div>
                              {/* Activity card */}
                              <div
                                className="flex-1 flex items-center justify-between rounded-md border bg-background p-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAsset(item);
                                }}
                                title="Double-click to edit"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                      <StockLogo ticker={displayTicker} name={item.name} size="sm" />
                                      <span className="font-medium text-xs">{item.name}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {displayShares > 0 ? `${displayShares} shares` : ""}
                                      {displayShares > 0 && item.createdAt ? " • " : ""}
                                      {item.createdAt ? formatTimeAgo(item.createdAt) : ""}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${
                                      isBuy
                                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                                        : "bg-red-100 text-red-700 hover:bg-red-100"
                                    }`}
                                  >
                                    {isBuy ? "Buy" : "Sell"}
                                  </Badge>
                                  <div className="flex flex-col items-end">
                                    <span className="font-medium text-gray-600">
                                      {formatCurrency(item.value)}
                                    </span>
                                    {isBuy && displayShares > 0 && (() => {
                                      // Use stored pricePerShare if available, otherwise use fetched stock price
                                      const pricePerShare = item.metadata?.pricePerShare || stockPrices[displayTicker?.toUpperCase() || ""];
                                      if (!pricePerShare) return null;
                                      const currentValue = pricePerShare * displayShares;
                                      const costBasis = item.value;
                                      const gainLoss = currentValue - costBasis;
                                      if (gainLoss === 0) return null;
                                      const isGain = gainLoss > 0;
                                      const absAmount = Math.abs(gainLoss);
                                      let dollarDisplay: string;
                                      if (absAmount >= 1000000) {
                                        dollarDisplay = `${(absAmount / 1000000).toFixed(2)}M`;
                                      } else if (absAmount >= 1000) {
                                        dollarDisplay = `${(absAmount / 1000).toFixed(2)}K`;
                                      } else {
                                        dollarDisplay = absAmount.toFixed(2);
                                      }
                                      return (
                                        <span className={`text-xs ${isGain ? "text-green-600" : "text-red-600"}`}>
                                          {isGain ? `(+$${dollarDisplay})` : `(-$${dollarDisplay})`}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
          </TabsContent>

          <TabsContent value="news" className="mt-4">
            <InvestmentNews tickers={tickers} />
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            <InvestmentInsights
              holdings={holdings}
              totalValue={total}
              userId={dbUserId || ""}
            />
          </TabsContent>
        </Tabs>
          </div>

          {/* Report Panel - Pie Chart */}
          {showReport && (
            <div className="lg:w-1/3 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Investment Allocation</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowReport(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="h-[250px] w-full">
                <svg viewBox="0 0 300 250" className="w-full h-full">
                  {(() => {
                    const chartTotal = pieChartData.reduce((sum, d) => sum + d.value, 0);
                    let currentAngle = -90;
                    const centerX = 150;
                    const centerY = 125;
                    const radius = 90;

                    return pieChartData.map((slice, i) => {
                      const percentage = (slice.value / chartTotal) * 100;
                      const angle = (percentage / 100) * 360;
                      const startAngle = currentAngle;
                      const endAngle = currentAngle + angle;
                      currentAngle = endAngle;

                      const startRad = (startAngle * Math.PI) / 180;
                      const endRad = (endAngle * Math.PI) / 180;

                      const x1 = centerX + radius * Math.cos(startRad);
                      const y1 = centerY + radius * Math.sin(startRad);
                      const x2 = centerX + radius * Math.cos(endRad);
                      const y2 = centerY + radius * Math.sin(endRad);

                      const largeArc = angle > 180 ? 1 : 0;

                      const pathD = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                      return (
                        <path
                          key={i}
                          d={pathD}
                          fill={slice.fill}
                          stroke="white"
                          strokeWidth="2"
                        />
                      );
                    });
                  })()}
                </svg>
              </div>
              <div className="space-y-2 mt-2">
                {pieChartData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground text-xs">
                        {((item.value / total) * 100).toFixed(1)}%
                      </span>
                      <span className="font-medium text-xs">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Investment</DialogTitle>
            <DialogDescription>
              Update the details of this investment
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
