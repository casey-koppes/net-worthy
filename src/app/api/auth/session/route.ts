import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { db, sessions } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ user: null });
    }

    if (useMockDb()) {
      // Use mock database
      const sessionWithUser = mockDb.sessions.findByToken(sessionToken);

      if (!sessionWithUser) {
        // Clear invalid cookie
        const response = NextResponse.json({ user: null });
        response.cookies.delete("session");
        return response;
      }

      return NextResponse.json({
        user: {
          id: sessionWithUser.user.id,
          email: sessionWithUser.user.email,
          displayName: sessionWithUser.user.displayName,
          nostrPubkey: sessionWithUser.user.nostrPubkey,
          profileImage: sessionWithUser.user.profileImage,
          accountType: sessionWithUser.user.accountType,
        },
      });
    } else {
      // Use real database
      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.token, sessionToken),
          gt(sessions.expiresAt, new Date())
        ),
        with: {
          user: true,
        },
      });

      if (!session) {
        // Clear invalid cookie
        const response = NextResponse.json({ user: null });
        response.cookies.delete("session");
        return response;
      }

      return NextResponse.json({
        user: {
          id: session.user.id,
          email: session.user.email,
          displayName: session.user.displayName,
          nostrPubkey: session.user.nostrPubkey,
          profileImage: session.user.profileImage,
          accountType: session.user.accountType,
        },
      });
    }
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ user: null });
  }
}
