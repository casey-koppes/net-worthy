import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

// Simple in-memory cache
const insightsCache = new Map<string, { data: PortfolioInsights; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Mock insights for when API is unavailable
function getMockInsights(): PortfolioInsights {
  return {
    grade: "B+",
    gradeDescription: "Good portfolio with room for improvement",
    summary: "Your portfolio shows a solid foundation with a mix of growth and value stocks. Consider adding more diversification across sectors.",
    strengths: [
      "Strong presence in technology sector",
      "Mix of large-cap and growth stocks",
      "Good liquidity in holdings",
    ],
    weaknesses: [
      "Concentration risk in single sector",
      "Limited international exposure",
      "No fixed income allocation",
    ],
    recommendations: [
      "Consider adding international ETFs for global diversification",
      "Add some bond exposure to reduce overall volatility",
      "Look into dividend-paying stocks for income generation",
    ],
    diversificationScore: 65,
    riskLevel: "Medium",
  };
}

export async function POST(request: NextRequest) {
  try {
    const { holdings, totalValue, userId } = await request.json();

    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return NextResponse.json(
        { error: "Holdings array is required" },
        { status: 400 }
      );
    }

    // Create cache key based on holdings
    const cacheKey = `${userId}-${JSON.stringify(holdings.map((h: PortfolioHolding) => h.ticker).sort())}`;

    // Check cache
    const cached = insightsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ insights: cached.data, cached: true });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json({ insights: getMockInsights(), mock: true });
    }

    // Build prompt for Claude
    const holdingsDescription = holdings
      .map((h: PortfolioHolding) =>
        `- ${h.name}${h.ticker ? ` (${h.ticker})` : ""}: $${h.value.toLocaleString()} (${h.percentage.toFixed(1)}% of portfolio)${h.shares > 0 ? `, ${h.shares} shares` : ""}`
      )
      .join("\n");

    const prompt = `Analyze this investment portfolio and provide insights:

Total Portfolio Value: $${totalValue.toLocaleString()}

Holdings:
${holdingsDescription}

Please provide a JSON response with the following structure:
{
  "grade": "A letter grade from A+ to F",
  "gradeDescription": "Brief explanation of the grade",
  "summary": "2-3 sentence overview of the portfolio",
  "strengths": ["array of 2-4 portfolio strengths"],
  "weaknesses": ["array of 2-4 areas for improvement"],
  "recommendations": ["array of 3-4 actionable recommendations"],
  "diversificationScore": "number from 0-100",
  "riskLevel": "Low, Medium, or High"
}

Consider factors like:
- Sector diversification
- Concentration risk (any holding > 30% is risky)
- Mix of growth vs value
- Market cap distribution
- Missing asset classes (bonds, international, etc.)

Respond ONLY with the JSON object, no other text.`;

    const client = new Anthropic({
      apiKey: anthropicApiKey,
    });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON from response
    const insights: PortfolioInsights = JSON.parse(responseText);

    // Update cache
    insightsCache.set(cacheKey, { data: insights, timestamp: Date.now() });

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Failed to generate portfolio insights:", error);
    // Fallback to mock insights on any error (billing, network, etc.)
    return NextResponse.json({ insights: getMockInsights(), mock: true });
  }
}
