import { NextRequest, NextResponse } from "next/server";
import { mockDb, useMockDb } from "@/lib/db/mock-db";
import { db, users, sessions, privacySettings } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Password strength validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    let user;
    let sessionToken: string;
    let expiresAt: Date;

    if (useMockDb()) {
      // Use mock database
      const existingUser = mockDb.users.findByEmail(email);
      if (existingUser) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }

      user = await mockDb.users.create({
        email,
        password,
        displayName,
      });

      const session = mockDb.sessions.create(user.id);
      sessionToken = session.token;
      expiresAt = new Date(session.expiresAt);
    } else {
      // Use real database
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          displayName: displayName || null,
          emailVerified: false,
        })
        .returning();

      user = newUser;

      // Create default privacy settings
      await db.insert(privacySettings).values({
        userId: user.id,
        defaultVisibility: "private",
        shareExactAmounts: false,
        shareBreakdown: false,
        displayFormat: "hidden",
      });

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
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
