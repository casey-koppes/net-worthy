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
  } catch (error) {
    console.error("Failed to create link token:", error);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
