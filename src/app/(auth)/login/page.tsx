"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useNostrLogin } from "@/lib/nostr/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { login: nostrLogin, isLoggingIn, hasExtension, user, profile } =
    useNostrLogin();
  const { setUser, setDbUserId, isLoggedIn } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // Signup modal state
  const [showSignup, setShowSignup] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupName, setSignupName] = useState("");

  useEffect(() => {
    setMounted(true);
    checkSession();
  }, []);

  useEffect(() => {
    if (user && !isRedirecting) {
      handleNostrSuccess();
    }
  }, [user]);

  async function checkSession() {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.user && !isRedirecting) {
        setIsRedirecting(true);
        setDbUserId(data.user.id);
        window.location.href = "/portfolio";
      }
    } catch (error) {
      console.error("Session check failed:", error);
    }
  }

  async function handleNostrSuccess() {
    if (isRedirecting) return;

    try {
      const res = await fetch("/api/auth/nostr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubkey: user?.pubkey,
          displayName: profile?.displayName,
          nip05: profile?.nip05,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsRedirecting(true);
        setUser(user!, profile);
        setDbUserId(data.user.id);
        window.location.href = "/portfolio";
      }
    } catch (error) {
      toast.error("Failed to complete login");
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isRedirecting) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }

      setIsRedirecting(true);
      setDbUserId(data.user.id);
      toast.success("Welcome back!");
      window.location.href = "/portfolio";
    } catch (error) {
      toast.error("Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    if (isRedirecting) return;

    setIsDemoLoading(true);

    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Demo login failed");
        return;
      }

      setIsRedirecting(true);
      setDbUserId(data.user.id);
      toast.success("Welcome to the demo!");
      window.location.href = "/portfolio";
    } catch (error) {
      toast.error("Demo login failed");
    } finally {
      setIsDemoLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (isRedirecting) return;

    if (signupPassword !== signupConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (signupPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          displayName: signupName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Signup failed");
        return;
      }

      setIsRedirecting(true);
      setDbUserId(data.user.id);
      toast.success("Account created successfully!");
      setShowSignup(false);
      window.location.href = "/portfolio";
    } catch (error) {
      toast.error("Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#000000" }}>
      {/* Subtle grey glow in bottom right */}
      <div
        className="absolute bottom-0 right-0 w-[60%] h-[60%] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at bottom right, rgba(140, 140, 140, 0.2) 0%, rgba(80, 80, 80, 0.1) 30%, rgba(40, 40, 40, 0.05) 50%, transparent 65%)",
        }}
      />
      {/* Space nebula glow in top left - deep blues */}
      <div
        className="absolute top-0 left-0 w-[60%] h-[60%] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top left, rgba(20, 30, 80, 0.9) 0%, rgba(15, 20, 50, 0.7) 25%, rgba(10, 15, 35, 0.4) 50%, transparent 70%)",
        }}
      />
      {/* Secondary subtle blue glow */}
      <div
        className="absolute top-[5%] left-[10%] w-[40%] h-[40%] opacity-40 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(30, 60, 120, 0.5) 0%, rgba(20, 40, 80, 0.2) 40%, transparent 70%)",
        }}
      />
      {/* Stars Background - concentrated in top left */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Bright stars */}
        <div className="absolute top-[5%] left-[10%] w-1.5 h-1.5 bg-white rounded-full opacity-95 shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
        <div className="absolute top-[8%] left-[25%] w-2 h-2 bg-white rounded-full opacity-90 shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
        <div className="absolute top-[12%] left-[5%] w-1 h-1 bg-white rounded-full opacity-85" />
        <div className="absolute top-[3%] left-[35%] w-1.5 h-1.5 bg-white rounded-full opacity-90 shadow-[0_0_4px_rgba(255,255,255,0.6)]" />
        <div className="absolute top-[15%] left-[18%] w-1 h-1 bg-white rounded-full opacity-80" />
        <div className="absolute top-[20%] left-[8%] w-1.5 h-1.5 bg-white rounded-full opacity-75" />
        <div className="absolute top-[7%] left-[42%] w-1 h-1 bg-white rounded-full opacity-70" />
        <div className="absolute top-[25%] left-[30%] w-1 h-1 bg-white rounded-full opacity-65" />
        <div className="absolute top-[2%] left-[50%] w-1 h-1 bg-white rounded-full opacity-60" />
        <div className="absolute top-[18%] left-[38%] w-1.5 h-1.5 bg-white rounded-full opacity-55" />
        <div className="absolute top-[30%] left-[15%] w-1 h-1 bg-white rounded-full opacity-50" />
        <div className="absolute top-[22%] left-[22%] w-1 h-1 bg-white rounded-full opacity-70" />
        {/* Medium stars */}
        <div className="absolute top-[35%] left-[5%] w-0.5 h-0.5 bg-white rounded-full opacity-60" />
        <div className="absolute top-[28%] left-[45%] w-0.5 h-0.5 bg-white rounded-full opacity-50" />
        <div className="absolute top-[10%] left-[55%] w-0.5 h-0.5 bg-white rounded-full opacity-45" />
        <div className="absolute top-[40%] left-[25%] w-0.5 h-0.5 bg-white rounded-full opacity-40" />
        <div className="absolute top-[14%] left-[62%] w-0.5 h-0.5 bg-white rounded-full opacity-35" />
        <div className="absolute top-[45%] left-[10%] w-0.5 h-0.5 bg-white rounded-full opacity-30" />
        {/* Small/dim stars scattered */}
        <div className="absolute top-[14%] left-[12%] w-px h-px bg-white rounded-full opacity-80" />
        <div className="absolute top-[9%] left-[32%] w-px h-px bg-white rounded-full opacity-70" />
        <div className="absolute top-[23%] left-[3%] w-px h-px bg-white rounded-full opacity-60" />
        <div className="absolute top-[17%] left-[48%] w-px h-px bg-white rounded-full opacity-50" />
        <div className="absolute top-[32%] left-[35%] w-px h-px bg-white rounded-full opacity-45" />
        <div className="absolute top-[6%] left-[18%] w-px h-px bg-white rounded-full opacity-75" />
        <div className="absolute top-[11%] left-[40%] w-px h-px bg-white rounded-full opacity-65" />
        <div className="absolute top-[27%] left-[12%] w-px h-px bg-white rounded-full opacity-55" />
        <div className="absolute top-[38%] left-[40%] w-px h-px bg-white rounded-full opacity-40" />
        <div className="absolute top-[50%] left-[20%] w-px h-px bg-white rounded-full opacity-35" />
        <div className="absolute top-[42%] left-[50%] w-px h-px bg-white rounded-full opacity-30" />
        <div className="absolute top-[55%] left-[35%] w-px h-px bg-white rounded-full opacity-25" />
      </div>
      {/* Main Container */}
      <div className="flex min-h-screen items-center justify-center px-4 relative z-10">
        <div className="flex w-full max-w-5xl flex-col items-center gap-8 lg:flex-row lg:items-start lg:gap-16">

          {/* Left Side - Branding */}
          <div className="flex-1 text-center lg:text-left lg:pt-10">
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-2">
              <img src="/logo.svg" alt="Net Worthy" className="h-20 w-20 lg:h-24 lg:w-24" />
              <h1 className="text-5xl font-bold text-white lg:text-6xl">
                Net Worthy
              </h1>
            </div>
            <p className="mt-4 text-xl text-gray-300 lg:text-2xl lg:leading-relaxed">
              Know your worth. Grow with the community.
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                onClick={handleDemoLogin}
                disabled={isDemoLoading}
                className="h-12 px-8 text-lg font-semibold text-white border-0"
                style={{ backgroundColor: "#7358ff" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#5d45e0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#7358ff")}
              >
                {isDemoLoading ? "Loading Demo..." : "Try Demo!"}
              </Button>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full max-w-md">
            <Card className="shadow-lg">
              <CardContent className="pt-6">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 text-base"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 text-base"
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 text-lg font-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Logging in..." : "Log In"}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Separator className="my-6" />

                <div className="flex flex-col gap-3">
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white border-0"
                    onClick={() => setShowSignup(true)}
                  >
                    Create new account
                  </Button>

                  {hasExtension && (
                    <Button
                      variant="outline"
                      className="w-full h-12 text-base font-semibold bg-purple-600 hover:bg-purple-700 text-white border-0"
                      onClick={() => nostrLogin()}
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? "Connecting..." : "Login with Nostr"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Nostr info for users without extension */}
            {!hasExtension && (
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400">
                  Want to use Nostr?{" "}
                  <a
                    href="https://getalby.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:underline"
                  >
                    Install Alby
                  </a>{" "}
                  or{" "}
                  <a
                    href="https://github.com/nickytonline/nos2x"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:underline"
                  >
                    nos2x
                  </a>
                </p>
              </div>
            )}

            {/* Footer Links */}
            <div className="mt-8 text-center text-sm text-gray-400">
              <p>
                <Link href="/privacy" className="hover:underline hover:text-gray-200">
                  Privacy Policy
                </Link>
                {" | "}
                <Link href="/terms" className="hover:underline hover:text-gray-200">
                  Terms of Service
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Signup Modal */}
      <Dialog open={showSignup} onOpenChange={setShowSignup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sign Up</DialogTitle>
            <DialogDescription>
              It's quick and easy.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <form onSubmit={handleSignup} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Input
                placeholder="Name (optional)"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email address"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="New password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                minLength={8}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Confirm password"
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              By clicking Sign Up, you agree to our{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms
              </Link>
              {" and "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-green-600 hover:bg-green-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          {hasExtension && (
            <>
              <Separator className="my-2" />
              <Button
                variant="outline"
                className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white border-0"
                onClick={() => {
                  setShowSignup(false);
                  nostrLogin();
                }}
                disabled={isLoggingIn}
              >
                Sign up with Nostr
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
