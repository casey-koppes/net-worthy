import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { db, users, sessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    let user;
    let sessionToken: string;
    let expiresAt: Date;

    if (useMockDb()) {
      // Use mock database
      const mockUser = mockDb.users.findByEmail(email);

      if (!mockUser || !mockUser.passwordHash) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      // Verify password
      const isValid = await mockDb.users.verifyPassword(mockUser, password);

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      user = mockUser;
      const session = mockDb.sessions.create(user.id);
      sessionToken = session.token;
      expiresAt = new Date(session.expiresAt);
    } else {
      // Use real database
      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (!dbUser || !dbUser.passwordHash) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      // Verify password
      const isValid = await bcrypt.compare(password, dbUser.passwordHash);

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      user = dbUser;

      // Create session
      sessionToken = crypto.randomBytes(32).toString("hex");
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.insert(sessions).values({
        userId: user.id,
        token: sessionToken,
        expiresAt,
      });
    }

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        nostrPubkey: user.nostrPubkey,
      },
    });

    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    );
  }
}
