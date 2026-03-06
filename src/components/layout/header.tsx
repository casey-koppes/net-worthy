"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/portfolio/reports", label: "Reports" },
  { href: "/activity", label: "Activity" },
  { href: "/community", label: "Community" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, profile, dbUser, logout } = useAuthStore();

  // Get display name from either Nostr profile or DB user
  const displayName = profile?.displayName || dbUser?.displayName || dbUser?.email;
  const avatarImage = profile?.image || dbUser?.profileImage;
  const identifier = profile?.nip05 || dbUser?.email;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center ml-[25px]">
        <Link href="/" className="flex items-center space-x-2">
          <img src="/icon.svg" alt="Net Worthy" className="h-8 w-8" />
          <span className="text-xl font-bold">Net Worthy</span>
        </Link>

        {isLoggedIn && (
          <nav className="ml-8 flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname === item.href || pathname?.startsWith(item.href + "/")
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center space-x-4">
          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={avatarImage}
                      alt={displayName || "User"}
                    />
                    <AvatarFallback className="bg-violet-500 text-white">
                      {displayName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {displayName && (
                      <p className="font-medium">{displayName}</p>
                    )}
                    {identifier && (
                      <p className="text-xs text-muted-foreground">
                        {identifier}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/privacy">Privacy</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/integrations">Integrations</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleLogout}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
