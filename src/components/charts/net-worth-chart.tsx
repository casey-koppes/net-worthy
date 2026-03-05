"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
} from "recharts";

interface HistoryDataPoint {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

interface NetWorthChartProps {
  data: HistoryDataPoint[];
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NetWorthChart({ data }: NetWorthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No historical data available yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="colorLiabilities" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          tickFormatter={formatCurrency}
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name === "netWorth"
              ? "Net Worth"
              : name === "totalAssets"
              ? "Assets"
              : "Liabilities",
          ]}
          labelFormatter={formatDate}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Legend
          formatter={(value) =>
            value === "netWorth"
              ? "Net Worth"
              : value === "totalAssets"
              ? "Assets"
              : "Liabilities"
          }
        />
        {/* Assets - Green (rendered first, appears at bottom) */}
        <Area
          type="monotone"
          dataKey="totalAssets"
          name="totalAssets"
          stroke="#22c55e"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorAssets)"
        />
        {/* Liabilities - Red */}
        <Area
          type="monotone"
          dataKey="totalLiabilities"
          name="totalLiabilities"
          stroke="#ef4444"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorLiabilities)"
        />
        {/* Net Worth - Blue (rendered last, appears on top) */}
        <Area
          type="monotone"
          dataKey="netWorth"
          name="netWorth"
          stroke="#3b82f6"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorNetWorth)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
