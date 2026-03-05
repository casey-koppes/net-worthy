"use client";

import { useEffect, useState } from "react";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNostrProfile } from "@/lib/nostr/hooks";
import { reactToEvent, fetchReactions, fetchReplies } from "@/lib/nostr/events";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

interface PostCardProps {
  event: NDKEvent;
  showReplies?: boolean;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;

  return new Date(timestamp * 1000).toLocaleDateString();
}

function shortenPubkey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
}

export function PostCard({ event, showReplies = false }: PostCardProps) {
  const { profile } = useNostrProfile(event.pubkey);
  const { isLoggedIn, pubkey: currentUserPubkey } = useAuthStore();
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [replies, setReplies] = useState<NDKEvent[]>([]);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    fetchReactionsCount();
    if (showReplies) {
      fetchRepliesData();
    }
  }, [event.id]);

  async function fetchReactionsCount() {
    try {
      const reactions = await fetchReactions(event.id);
      setLikes(reactions.filter((r) => r.content === "+" || r.content === "").length);
      if (currentUserPubkey) {
        setHasLiked(reactions.some((r) => r.pubkey === currentUserPubkey));
      }
    } catch (error) {
      console.error("Failed to fetch reactions:", error);
    }
  }

  async function fetchRepliesData() {
    try {
      const repliesData = await fetchReplies(event.id);
      setReplies(repliesData);
    } catch (error) {
      console.error("Failed to fetch replies:", error);
    }
  }

  async function handleLike() {
    if (!isLoggedIn) {
      toast.error("Please login to like posts");
      return;
    }

    if (hasLiked || isLiking) return;

    setIsLiking(true);
    try {
      await reactToEvent(event.id, event.pubkey, "+");
      setLikes((prev) => prev + 1);
      setHasLiked(true);
      toast.success("Liked!");
    } catch (error) {
      toast.error("Failed to like post");
    } finally {
      setIsLiking(false);
    }
  }

  async function handleReply() {
    if (!isLoggedIn) {
      toast.error("Please login to reply");
      return;
    }

    if (!replyContent.trim()) return;

    try {
      const { replyToEvent } = await import("@/lib/nostr/events");
      await replyToEvent(event.id, event.pubkey, replyContent);
      setReplyContent("");
      setShowReplyForm(false);
      toast.success("Reply posted!");
      fetchRepliesData();
    } catch (error) {
      toast.error("Failed to post reply");
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/post/${event.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Author */}
        <div className="flex items-start gap-3">
          <a href={`/community/${event.pubkey}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.image} />
              <AvatarFallback>
                {profile?.displayName?.charAt(0).toUpperCase() ||
                  event.pubkey.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={`/community/${event.pubkey}`}
                className="font-semibold hover:underline"
              >
                {profile?.displayName || shortenPubkey(event.pubkey)}
              </a>
              {profile?.nip05 && (
                <span className="text-sm text-muted-foreground">
                  {profile.nip05}
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {formatTimeAgo(event.created_at || 0)}
              </span>
            </div>

            {/* Content */}
            <p className="mt-2 whitespace-pre-wrap break-words">{event.content}</p>

            {/* Actions */}
            <div className="flex items-center gap-4 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={hasLiked || isLiking}
                className={hasLiked ? "text-red-500" : ""}
              >
                {hasLiked ? "Liked" : "Like"} {likes > 0 && `(${likes})`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                Reply {replies.length > 0 && `(${replies.length})`}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleShare}>
                Share
              </Button>
            </div>

            {/* Reply Form */}
            {showReplyForm && (
              <div className="mt-4 space-y-2">
                <textarea
                  className="w-full p-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={2}
                  placeholder="Write a reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleReply}>
                    Post Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowReplyForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Replies */}
            {showReplies && replies.length > 0 && (
              <div className="mt-4 space-y-3 border-l-2 pl-4">
                {replies.map((reply) => (
                  <PostCard key={reply.id} event={reply} showReplies={false} />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
