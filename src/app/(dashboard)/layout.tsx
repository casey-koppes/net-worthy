"use client";

import { useEffect, useState, useRef } from "react";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setDbUser, setLoading } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hasChecked = useRef(false);

  // Check session on mount - runs only once
  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();

        if (data.user) {
          setDbUser(data.user);
          setIsAuthenticated(true);
        } else {
          window.location.href = "/login";
          return;
        }
      } catch (error) {
        console.error("Session check failed:", error);
        window.location.href = "/login";
        return;
      } finally {
        setIsChecking(false);
        setLoading(false);
      }
    }

    checkSession();
  }, []);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 px-8 md:px-12 lg:px-16">{children}</main>
    </div>
  );
}
