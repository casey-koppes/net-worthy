"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get display name from either Nostr profile or DB user
  const displayName = profile?.displayName || dbUser?.displayName || dbUser?.email;
  const avatarImage = profile?.image || dbUser?.profileImage;
  const identifier = profile?.nip05 || dbUser?.email;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4 md:ml-[25px] md:px-0">
        {/* Mobile menu button */}
        {isLoggedIn && (
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        )}

        <Link href="/" className="flex items-center space-x-2">
          <img src="/icon.svg" alt="Net Worthy" className="h-8 w-8" />
          <span className="text-xl font-bold">Net Worthy</span>
        </Link>

        {/* Desktop navigation */}
        {isLoggedIn && (
          <nav className="ml-8 hidden items-center space-x-6 md:flex">
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

        {/* Mobile navigation sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <img src="/icon.svg" alt="Net Worthy" className="h-6 w-6" />
                Net Worthy
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col space-y-1 mt-6">
              {navItems.map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      pathname === item.href || pathname?.startsWith(item.href + "/")
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-6 border-t pt-4">
              <nav className="flex flex-col space-y-1">
                <SheetClose asChild>
                  <Link
                    href="/settings"
                    onClick={closeMobileMenu}
                    className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Settings
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/settings/privacy"
                    onClick={closeMobileMenu}
                    className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Privacy
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/settings/integrations"
                    onClick={closeMobileMenu}
                    className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Integrations
                  </Link>
                </SheetClose>
                <button
                  onClick={() => {
                    closeMobileMenu();
                    handleLogout();
                  }}
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-accent"
                >
                  Log out
                </button>
              </nav>
            </div>
          </SheetContent>
        </Sheet>

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
