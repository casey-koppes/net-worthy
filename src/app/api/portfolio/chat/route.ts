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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { question, holdings, totalValue, insights, chatHistory } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      // Return mock response if no API key
      return NextResponse.json({
        answer: "I'd be happy to help analyze your portfolio, but the AI service is not configured. Please add your Anthropic API key to enable this feature.",
        mock: true,
      });
    }

    // Build context about the portfolio
    const holdingsDescription = holdings
      .map((h: PortfolioHolding) =>
        `- ${h.name}${h.ticker ? ` (${h.ticker})` : ""}: $${h.value.toLocaleString()} (${h.percentage.toFixed(1)}% of portfolio)${h.shares > 0 ? `, ${h.shares} shares` : ""}`
      )
      .join("\n");

    const insightsContext = insights
      ? `
Current Portfolio Analysis:
- Grade: ${insights.grade} - ${insights.gradeDescription}
- Summary: ${insights.summary}
- Diversification Score: ${insights.diversificationScore}%
- Risk Level: ${insights.riskLevel}
- Strengths: ${insights.strengths.join("; ")}
- Weaknesses: ${insights.weaknesses.join("; ")}
- Recommendations: ${insights.recommendations.join("; ")}
`
      : "";

    // Build conversation history for context
    const conversationHistory = (chatHistory || []).map((msg: ChatMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    const systemPrompt = `You are a helpful financial advisor assistant analyzing a user's investment portfolio. Be concise but thorough in your responses.

Portfolio Context:
Total Portfolio Value: $${totalValue.toLocaleString()}

Holdings:
${holdingsDescription}
${insightsContext}

Guidelines:
- Provide specific, actionable advice based on their actual holdings
- Reference specific stocks/investments in their portfolio when relevant
- Be honest about risks and limitations
- Keep responses focused and under 200 words unless more detail is needed
- If asked about specific stocks, provide balanced analysis
- Never guarantee returns or make promises about performance
- Remind users to consult a professional for major financial decisions`;

    const client = new Anthropic({
      apiKey: anthropicApiKey,
    });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        { role: "user", content: question },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ answer: responseText });
  } catch (error) {
    console.error("Failed to process portfolio question:", error);
    // Fallback to a helpful message on any error
    return NextResponse.json({
      answer: "I'm currently unable to process questions due to a service limitation. The AI chat feature requires an active Anthropic API subscription. In the meantime, you can review the portfolio insights shown above for guidance on your investments.",
      mock: true,
    });
  }
}
