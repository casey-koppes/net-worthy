import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/icon.svg" alt="Net Worthy" className="h-8 w-8" />
            <span className="text-xl font-bold">Net Worthy</span>
          </Link>
          <Button asChild>
            <Link href="/login">Get Started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container flex flex-col items-center justify-center gap-8 py-24 text-center md:py-32">
          <img src="/logo.svg" alt="Net Worthy" className="h-32 w-32 md:h-40 md:w-40" />
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Know Your Worth
              <br />
              <span className="text-primary">Social &quot;Networthing&quot; App.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
              Track your net worth in real-time by connecting bank accounts,
              crypto wallets, and more. Share your financial journey with the
              community on your terms.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/login">Start Tracking Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t bg-muted/50 py-16 md:py-24">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold">
              What can it do?
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-lg border bg-background p-6">
                <div className="mb-4 text-2xl">Net Worth</div>
                <h3 className="mb-2 text-xl font-semibold">
                  Track Your Portfolio
                </h3>
                <p className="text-muted-foreground">
                  Securely link bank accounts, brokerages, and crypto wallets.
                  Your data syncs automatically to give you real-time net worth.
                </p>
              </div>

              <div className="rounded-lg border bg-background p-6">
                <div className="mb-4 text-2xl">Follow</div>
                <h3 className="mb-2 text-xl font-semibold">
                  Connect with Community
                </h3>
                <p className="text-muted-foreground">
                  Choose to stay private or share your net worth journey with
                  your friends or the community.
                </p>
              </div>

              <div className="rounded-lg border bg-background p-6">
                <div className="mb-4 text-2xl">Verify Creditworthiness</div>
                <h3 className="mb-2 text-xl font-semibold">
                  Validate Networth Via API
                </h3>
                <p className="text-muted-foreground">
                  Third parties can verify user net worth through our secure API,
                  enabling trust and transparency for loans, rentals, and partnerships.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-16 md:py-24">
          <div className="container">
            <h2 className="mb-12 text-center text-3xl font-bold">
              How It Works
            </h2>
            <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  1
                </div>
                <h3 className="mb-2 font-semibold">Sign Up</h3>
                <p className="text-sm text-muted-foreground">
                  Create an account with email or use Nostr
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  2
                </div>
                <h3 className="mb-2 font-semibold">Connect Accounts</h3>
                <p className="text-sm text-muted-foreground">
                  Link banks, brokerages, and crypto wallets
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  3
                </div>
                <h3 className="mb-2 font-semibold">Track & Grow</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor your net worth and watch it grow over time
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  4
                </div>
                <h3 className="mb-2 font-semibold">Share (Optional)</h3>
                <p className="text-sm text-muted-foreground">
                  Share milestones with friends or the community
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/50 py-16 md:py-24">
          <div className="container text-center">
            <h2 className="mb-4 text-3xl font-bold">
              Ready to Know Your Worth?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              Join thousands of people taking control of their financial future.
              Start tracking your net worth today.
            </p>
            <Button size="lg" asChild>
              <Link href="/login">Get Started - It&apos;s Free</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            2026 Net Worthy. Built on Nostr.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
