"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CheckCircle,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  Send,
  Shield,
  TrendingUp,
  User,
  Bot,
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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function askQuestion() {
    if (!currentQuestion.trim() || isAskingQuestion) return;

    const question = currentQuestion.trim();
    setCurrentQuestion("");
    setIsAskingQuestion(true);

    // Add user message immediately
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);

    try {
      const res = await fetch("/api/portfolio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          holdings,
          totalValue,
          insights,
          chatHistory: chatMessages,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't process your question. Please try again." },
        ]);
      }
    } catch (err) {
      console.error("Failed to ask question:", err);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsAskingQuestion(false);
    }
  }

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

      {/* AI Chat Section */}
      <div className="pt-4 border-t">
        <h5 className="font-medium flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-primary" />
          Ask AI About Your Portfolio
        </h5>

        {/* Chat Messages */}
        {chatMessages.length > 0 && (
          <div className="mb-3 max-h-64 overflow-y-auto space-y-3 rounded-lg border bg-muted/30 p-3">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isAskingQuestion && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="rounded-lg px-3 py-2 bg-background border text-sm">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin inline mr-2" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Question Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Ask about your investments..."
            value={currentQuestion}
            onChange={(e) => setCurrentQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && askQuestion()}
            disabled={isAskingQuestion}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={askQuestion}
            disabled={!currentQuestion.trim() || isAskingQuestion}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Suggestion Chips */}
        {chatMessages.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              "How can I improve my diversification?",
              "What's my biggest risk?",
              "Should I rebalance?",
              "Explain my grade",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setCurrentQuestion(suggestion);
                }}
                className="text-xs px-2 py-1 rounded-full border hover:bg-muted transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Regenerate Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={generateInsights}
          className="w-full text-muted-foreground mt-3"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate Analysis
        </Button>
      </div>
    </div>
  );
}
