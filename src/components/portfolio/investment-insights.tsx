"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  Shield,
  TrendingUp,
} from "lucide-react";

interface PortfolioHolding {
  name: string;
  ticker: string | null;
  value: number;
  shares: number;
  percentage: number;
}

interface PortfolioInsights {
  grade: string;
  gradeDescription: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  diversificationScore: number;
  riskLevel: "Low" | "Medium" | "High";
}

interface InvestmentInsightsProps {
  holdings: PortfolioHolding[];
  totalValue: number;
  userId: string;
}

function getGradeColor(grade: string): string {
  const letter = grade.charAt(0).toUpperCase();
  switch (letter) {
    case "A":
      return "bg-green-500";
    case "B":
      return "bg-blue-500";
    case "C":
      return "bg-yellow-500";
    case "D":
      return "bg-orange-500";
    case "F":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case "Low":
      return "text-green-600 bg-green-100";
    case "Medium":
      return "text-yellow-600 bg-yellow-100";
    case "High":
      return "text-red-600 bg-red-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

export function InvestmentInsights({
  holdings,
  totalValue,
  userId,
}: InvestmentInsightsProps) {
  const [insights, setInsights] = useState<PortfolioInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateInsights() {
    if (holdings.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/portfolio/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings, totalValue, userId }),
      });

      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights);
      } else {
        setError("Failed to generate insights");
      }
    } catch (err) {
      console.error("Failed to generate insights:", err);
      setError("Failed to generate insights");
    } finally {
      setIsLoading(false);
    }
  }

  // Auto-generate insights on mount
  useEffect(() => {
    if (holdings.length > 0 && !insights && !isLoading && !error) {
      generateInsights();
    }
  }, [holdings.length]);

  if (holdings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Add investments to get AI-powered portfolio insights</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Analyzing your portfolio...</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={generateInsights} className="mt-2">
          Try again
        </Button>
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-6 py-2">
      {/* Grade and Summary */}
      <div className="flex items-start gap-4">
        <div
          className={`w-16 h-16 rounded-xl ${getGradeColor(insights.grade)} flex items-center justify-center text-white text-2xl font-bold shrink-0`}
        >
          {insights.grade}
        </div>
        <div>
          <h4 className="font-semibold">{insights.gradeDescription}</h4>
          <p className="text-sm text-muted-foreground mt-1">{insights.summary}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Diversification
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${insights.diversificationScore}%` }}
              />
            </div>
            <span className="text-sm font-medium">{insights.diversificationScore}%</span>
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="h-4 w-4" />
            Risk Level
          </div>
          <Badge className={getRiskColor(insights.riskLevel)}>
            {insights.riskLevel}
          </Badge>
        </div>
      </div>

      {/* Strengths */}
      <div>
        <h5 className="font-medium flex items-center gap-2 mb-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          Strengths
        </h5>
        <ul className="space-y-1">
          {insights.strengths.map((strength, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-green-600 mt-0.5">+</span>
              {strength}
            </li>
          ))}
        </ul>
      </div>

      {/* Weaknesses */}
      <div>
        <h5 className="font-medium flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          Areas for Improvement
        </h5>
        <ul className="space-y-1">
          {insights.weaknesses.map((weakness, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-yellow-600 mt-0.5">!</span>
              {weakness}
            </li>
          ))}
        </ul>
      </div>

      {/* Recommendations */}
      <div>
        <h5 className="font-medium flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          Recommendations
        </h5>
        <ul className="space-y-2">
          {insights.recommendations.map((rec, i) => (
            <li
              key={i}
              className="text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 rounded-md p-2"
            >
              {rec}
            </li>
          ))}
        </ul>
      </div>

      {/* Refresh */}
      <div className="pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={generateInsights}
          className="w-full text-muted-foreground"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate Analysis
        </Button>
      </div>
    </div>
  );
}
