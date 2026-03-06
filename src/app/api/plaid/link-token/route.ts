import { NextRequest, NextResponse } from "next/server";
import {
  plaidClient,
  DEFAULT_PRODUCTS,
  SUPPORTED_COUNTRIES,
} from "@/lib/plaid/client";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    console.log("[Plaid] Creating link token for user:", userId);
    console.log("[Plaid] PLAID_CLIENT_ID set:", !!process.env.PLAID_CLIENT_ID);
    console.log("[Plaid] PLAID_SECRET set:", !!process.env.PLAID_SECRET);
    console.log("[Plaid] PLAID_ENV:", process.env.PLAID_ENV || "sandbox");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      console.error("[Plaid] Missing credentials!");
      return NextResponse.json(
        { error: "Plaid credentials not configured" },
        { status: 500 }
      );
    }

    // Create link token
    console.log("[Plaid] Calling linkTokenCreate...");
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: "Net Worthy",
      products: DEFAULT_PRODUCTS,
      country_codes: SUPPORTED_COUNTRIES,
      language: "en",
    });

    console.log("[Plaid] Link token created successfully");

    return NextResponse.json({
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: any) {
    console.error("Failed to create link token:", error);

    // Log detailed Plaid error if available
    if (error?.response?.data) {
      console.error("Plaid error details:", JSON.stringify(error.response.data, null, 2));
    }

    const errorMessage = error?.response?.data?.error_message || "Failed to create link token";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
