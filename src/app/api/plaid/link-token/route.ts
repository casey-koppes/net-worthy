import { NextRequest, NextResponse } from "next/server";
import {
  plaidClient,
  DEFAULT_PRODUCTS,
  SUPPORTED_COUNTRIES,
} from "@/lib/plaid/client";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Create link token
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: "Net Worthy",
      products: DEFAULT_PRODUCTS,
      country_codes: SUPPORTED_COUNTRIES,
      language: "en",
    });

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
