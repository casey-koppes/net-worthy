import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { db, sessions } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("session")?.value;

    if (sessionToken) {
      if (useMockDb()) {
        // Use mock database
        mockDb.sessions.delete(sessionToken);
      } else {
        // Use real database
        await db.delete(sessions).where(eq(sessions.token, sessionToken));
      }
    }

    // Clear cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete("session");

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}
