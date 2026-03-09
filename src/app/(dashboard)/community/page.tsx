"use client";

import { useEffect, useState, useCallback } from "react";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostCard } from "@/components/feed/post-card";
import { CreatePostForm } from "@/components/feed/create-post-form";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchGlobalFeed, fetchFeed, subscribeFeed } from "@/lib/nostr/events";
import { getNDK } from "@/lib/nostr/ndk";
import { toast } from "sonner";

interface FollowingUser {
  id: string;
  pubkey: string;
  displayName: string | null;
  nip05: string | null;
}

// Sample posts for when the feed is empty
const SAMPLE_POSTS = [
  {
    id: "sample-1",
    author: { name: "Sarah Chen", handle: "@sarahfinance", avatar: "SC" },
    content: "Just hit a huge milestone - my portfolio crossed $100K! 🎉 The secret? Consistent monthly contributions and staying the course during market dips. Started with just $500/month 3 years ago. Time in the market > timing the market.",
    timestamp: "2h ago",
    likes: 47,
    comments: 12,
  },
  {
    id: "sample-2",
    author: { name: "Marcus Williams", handle: "@marcuswealthbuilder", avatar: "MW" },
    content: "My top 5 tips for growing your net worth in 2026:\n\n1. Automate your investments (set it and forget it)\n2. Max out your 401k match - it's free money!\n3. Keep 3-6 months emergency fund in HYSA\n4. Diversify across asset classes\n5. Track everything (love using Net-Worthy for this!)\n\nWhat would you add? 👇",
    timestamp: "4h ago",
    likes: 89,
    comments: 34,
  },
  {
    id: "sample-3",
    author: { name: "Emma Rodriguez", handle: "@emmainvests", avatar: "ER" },
    content: "Unpopular opinion: You don't need to pick individual stocks to build wealth. A simple 3-fund portfolio (US stocks, international stocks, bonds) has beaten most active managers over 20+ years. Keep it simple, keep fees low, stay invested. 📈",
    timestamp: "6h ago",
    likes: 156,
    comments: 45,
  },
  {
    id: "sample-4",
    author: { name: "David Park", handle: "@davidfire", avatar: "DP" },
    content: "Celebrating 5 years on my FIRE journey! Net worth went from -$20K (student loans) to $450K. The biggest game changers:\n\n• Increased income by 60% through skill building\n• Lived below my means (50% savings rate)\n• Invested aggressively in index funds\n• Added real estate as passive income\n\nIf I can do it, so can you! 💪",
    timestamp: "8h ago",
    likes: 234,
    comments: 67,
  },
  {
    id: "sample-5",
    author: { name: "Lisa Thompson", handle: "@lisabudgets", avatar: "LT" },
    content: "PSA: Your net worth includes more than just investments!\n\n✓ Cash & savings\n✓ Investment accounts\n✓ Retirement accounts\n✓ Real estate equity\n✓ Crypto holdings\n✓ Business value\n\nMinus liabilities (mortgages, loans, credit cards)\n\nAre you tracking all of these? The full picture matters! 📊",
    timestamp: "12h ago",
    likes: 78,
    comments: 21,
  },
  {
    id: "sample-6",
    author: { name: "James Mitchell", handle: "@jameswealth", avatar: "JM" },
    content: "The compound interest math that changed my perspective:\n\nInvesting $500/month at 8% average return:\n• 10 years = $91,473\n• 20 years = $294,510\n• 30 years = $745,180\n\nStarting 10 years earlier is worth more than doubling your contributions later. Time is your greatest asset! ⏰",
    timestamp: "1d ago",
    likes: 312,
    comments: 89,
  },
];

export default function CommunityPage() {
  const { dbUserId, pubkey, profile } = useAuthStore();
  const [feed, setFeed] = useState<NDKEvent[]>([]);
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("global");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch following list
  useEffect(() => {
    if (dbUserId) {
      fetchFollowing();
    }
  }, [dbUserId]);

  // Fetch feed based on active tab
  useEffect(() => {
    if (activeTab === "following" && following.length > 0) {
      fetchFollowingFeed();
    } else if (activeTab === "global") {
      fetchGlobalFeedData();
    }
  }, [activeTab, following]);

  async function fetchFollowing() {
    try {
      const res = await fetch(`/api/community/follows?userId=${dbUserId}&type=following`);
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following || []);
      }
    } catch (error) {
      console.error("Failed to fetch following:", error);
    }
  }

  async function fetchGlobalFeedData() {
    setIsLoading(true);
    try {
      const events = await fetchGlobalFeed(50);
      setFeed(events);
    } catch (error) {
      console.error("Failed to fetch global feed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchFollowingFeed() {
    setIsLoading(true);
    try {
      const pubkeys = following.map((f) => f.pubkey);
      if (pubkeys.length > 0) {
        const events = await fetchFeed(pubkeys, 50);
        setFeed(events);
      } else {
        setFeed([]);
      }
    } catch (error) {
      console.error("Failed to fetch following feed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleNewPost = useCallback((event: NDKEvent) => {
    setFeed((prev) => [event, ...prev]);
  }, []);

  async function searchUsers() {
    if (!searchQuery.trim()) return;

    try {
      const ndk = getNDK();
      await ndk.connect();

      // Try to find user by NIP-05 or pubkey
      let searchPubkey = searchQuery;

      // If it looks like a NIP-05, try to resolve it
      if (searchQuery.includes("@") || !searchQuery.match(/^[0-9a-f]{64}$/)) {
        try {
          const user = ndk.getUser({ nip05: searchQuery });
          await user.fetchProfile();
          searchPubkey = user.pubkey;
        } catch {
          toast.error("User not found");
          return;
        }
      }

      // Navigate to user profile
      window.location.href = `/community/${searchPubkey}`;
    } catch (error) {
      toast.error("Failed to search for user");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Community</h1>
          <p className="text-muted-foreground">
            Connect with other members and share your journey
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="Search by NIP-05 (user@domain.com) or pubkey"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
            />
            <Button onClick={searchUsers}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* Create Post */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Share with Community</CardTitle>
            </CardHeader>
            <CardContent>
              <CreatePostForm onSuccess={handleNewPost} />
            </CardContent>
          </Card>

          {/* Feed Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="global">Global Feed</TabsTrigger>
              <TabsTrigger value="following">Following</TabsTrigger>
            </TabsList>

            <TabsContent value="global" className="mt-4 space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="animate-pulse space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted" />
                            <div className="h-4 w-32 bg-muted rounded" />
                          </div>
                          <div className="h-20 bg-muted rounded" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : feed.length === 0 ? (
                <>
                  <Card className="bg-muted/30 border-dashed">
                    <CardContent className="py-4 text-center text-muted-foreground text-sm">
                      Showing sample posts • Connect your Nostr account to see live content
                    </CardContent>
                  </Card>
                  {SAMPLE_POSTS.map((post) => (
                    <Card key={post.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {post.author.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{post.author.name}</span>
                              <span className="text-muted-foreground text-sm">{post.author.handle}</span>
                              <span className="text-muted-foreground text-sm">•</span>
                              <span className="text-muted-foreground text-sm">{post.timestamp}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap">{post.content}</p>
                            <div className="flex items-center gap-6 mt-4 text-muted-foreground text-sm">
                              <span className="flex items-center gap-1">
                                ❤️ {post.likes}
                              </span>
                              <span className="flex items-center gap-1">
                                💬 {post.comments}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              ) : (
                feed.map((event) => (
                  <PostCard key={event.id} event={event} />
                ))
              )}
            </TabsContent>

            <TabsContent value="following" className="mt-4 space-y-4">
              {following.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    You're not following anyone yet. Search for users to follow!
                  </CardContent>
                </Card>
              ) : isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="animate-pulse space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted" />
                            <div className="h-4 w-32 bg-muted rounded" />
                          </div>
                          <div className="h-20 bg-muted rounded" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : feed.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No posts from people you follow yet.
                  </CardContent>
                </Card>
              ) : (
                feed.map((event) => (
                  <PostCard key={event.id} event={event} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Following List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Following</CardTitle>
              <CardDescription>
                {following.length} member{following.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {following.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Search for community members to follow
                </p>
              ) : (
                <div className="space-y-3">
                  {following.slice(0, 5).map((user) => (
                    <a
                      key={user.id}
                      href={`/community/${user.pubkey}`}
                      className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -mx-2"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {user.displayName?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {user.displayName || "Anonymous"}
                        </p>
                        {user.nip05 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {user.nip05}
                          </p>
                        )}
                      </div>
                    </a>
                  ))}
                  {following.length > 5 && (
                    <Button variant="ghost" size="sm" className="w-full">
                      View all ({following.length})
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggested Users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Suggested</CardTitle>
              <CardDescription>Community members to follow</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Suggestions coming soon based on your interests
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
