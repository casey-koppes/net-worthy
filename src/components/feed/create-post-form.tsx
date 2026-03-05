"use client";

import { useState, useEffect } from "react";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { createTextNote } from "@/lib/nostr/events";
import { hasNip07Extension, loginWithNip07, getNDK } from "@/lib/nostr/ndk";
import { toast } from "sonner";

interface CreatePostFormProps {
  onSuccess?: (event: NDKEvent) => void;
  placeholder?: string;
}

export function CreatePostForm({
  onSuccess,
  placeholder = "What's on your mind? Share your financial journey...",
}: CreatePostFormProps) {
  const { isLoggedIn, setUser } = useAuthStore();
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [hasNostrSigner, setHasNostrSigner] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [isConnectingNostr, setIsConnectingNostr] = useState(false);

  useEffect(() => {
    // Check if NDK has a signer set up
    const ndk = getNDK();
    setHasNostrSigner(!!ndk.signer);
    // Check if NIP-07 extension is available (client-side only)
    setHasExtension(hasNip07Extension());
  }, []);

  async function handleConnectNostr() {
    if (!hasNip07Extension()) {
      toast.error("No Nostr extension found. Please install Alby or nos2x.");
      return;
    }

    setIsConnectingNostr(true);
    try {
      const user = await loginWithNip07();
      if (user) {
        setUser(user);
        setHasNostrSigner(true);
        toast.success("Nostr connected! You can now post.");
      } else {
        toast.error("Failed to connect Nostr extension");
      }
    } catch (error) {
      toast.error("Failed to connect Nostr extension");
      console.error("Nostr connect error:", error);
    } finally {
      setIsConnectingNostr(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isLoggedIn) {
      toast.error("Please login to post");
      return;
    }

    if (!content.trim()) {
      toast.error("Please enter some content");
      return;
    }

    setIsPosting(true);
    try {
      const event = await createTextNote(content);
      if (event) {
        setContent("");
        toast.success("Posted successfully!");
        onSuccess?.(event);
      } else {
        toast.error("Failed to post. Make sure your Nostr extension is connected.");
      }
    } catch (error) {
      toast.error("Failed to post");
      console.error("Failed to post:", error);
    } finally {
      setIsPosting(false);
    }
  }

  // Show connect Nostr prompt for users without a signer
  if (isLoggedIn && !hasNostrSigner) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          To post to the community feed, you need to connect a Nostr extension (like Alby or nos2x).
          This allows you to sign messages with your Nostr identity.
        </p>
        {hasExtension ? (
          <Button onClick={handleConnectNostr} disabled={isConnectingNostr}>
            {isConnectingNostr ? "Connecting..." : "Connect Nostr Extension"}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">No Nostr extension detected.</p>
            <p className="text-sm text-muted-foreground">
              Install{" "}
              <a
                href="https://getalby.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Alby
              </a>{" "}
              or{" "}
              <a
                href="https://github.com/nickytonline/nos2x"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                nos2x
              </a>{" "}
              to post.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
        placeholder={placeholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={!isLoggedIn || isPosting}
      />
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {content.length} / 500 characters
        </p>
        <Button type="submit" disabled={!isLoggedIn || isPosting || !content.trim()}>
          {isPosting ? "Posting..." : "Post"}
        </Button>
      </div>
    </form>
  );
}
