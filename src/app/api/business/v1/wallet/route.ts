import { NextRequest, NextResponse } from "next/server";
import { fetchWalletData, CHAIN_CONFIGS } from "@/lib/crypto/chains";

// Demo API key for testing (works in all environments)
const DEMO_API_KEY = "nw_demo_api_key_2024";

// Verify API key
function verifyApiKey(apiKey: string): boolean {
  return apiKey === DEMO_API_KEY || apiKey === "test_api_key_12345";
}

interface WalletResponse {
  chain: string;
  chainName: string;
  symbol: string;
  address: string;
  balance: number;
  balanceUsd: number;
  pricePerUnit: number;
  verifiedAt: string;
}

// GET endpoint - retrieve wallet balance by chain and address
export async function GET(request: NextRequest) {
  try {
    // Get API key from X-API-Key header
    const apiKey = request.headers.get("X-API-Key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Use X-API-Key header" },
        { status: 401 }
      );
    }

    if (!verifyApiKey(apiKey)) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // Get chain and address from query params
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get("chain")?.toLowerCase();
    const address = searchParams.get("address");

    if (!chain) {
      return NextResponse.json(
        { error: "Chain parameter is required (e.g., bitcoin, ethereum, solana)" },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    // Validate chain
    const chainConfig = CHAIN_CONFIGS[chain];
    if (!chainConfig) {
      const supportedChains = Object.keys(CHAIN_CONFIGS).join(", ");
      return NextResponse.json(
        { error: `Unsupported chain: ${chain}. Supported chains: ${supportedChains}` },
        { status: 400 }
      );
    }

    // Fetch wallet data
    const { balance, balanceUsd } = await fetchWalletData(chain, address);
    const pricePerUnit = balance > 0 ? balanceUsd / balance : 0;

    const response: WalletResponse = {
      chain,
      chainName: chainConfig.name,
      symbol: chainConfig.symbol,
      address,
      balance: Math.round(balance * 100000000) / 100000000, // 8 decimal places for crypto
      balanceUsd: Math.round(balanceUsd * 100) / 100,
      pricePerUnit: Math.round(pricePerUnit * 100) / 100,
      verifiedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Wallet verification failed:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// POST endpoint - same functionality, accepts chain and address in body
export async function POST(request: NextRequest) {
  try {
    // Get API key from X-API-Key header
    const apiKey = request.headers.get("X-API-Key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Use X-API-Key header" },
        { status: 401 }
      );
    }

    if (!verifyApiKey(apiKey)) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // Get chain and address from body
    const { chain, address } = await request.json();

    if (!chain) {
      return NextResponse.json(
        { error: "Chain is required in request body (e.g., bitcoin, ethereum, solana)" },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { error: "Address is required in request body" },
        { status: 400 }
      );
    }

    // Redirect to GET logic by constructing URL
    const url = new URL(request.url);
    url.searchParams.set("chain", chain);
    url.searchParams.set("address", address);

    // Create a new request with the params
    const getRequest = new NextRequest(url, {
      headers: request.headers,
    });

    return GET(getRequest);
  } catch (error) {
    console.error("Wallet verification failed:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
