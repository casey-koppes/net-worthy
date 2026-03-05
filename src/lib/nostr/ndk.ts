import NDK, { NDKNip07Signer, NDKUser } from "@nostr-dev-kit/ndk";

// Default relays for the Net Worthy app
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://nostr.wine",
];

// Singleton NDK instance
let ndkInstance: NDK | null = null;

export function getNDK(): NDK {
  if (!ndkInstance) {
    ndkInstance = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
    });
  }
  return ndkInstance;
}

export async function connectNDK(): Promise<NDK> {
  const ndk = getNDK();
  await ndk.connect();
  return ndk;
}

// Check if NIP-07 extension is available (Alby, nos2x, etc.)
export function hasNip07Extension(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.nostr !== "undefined";
}

// Login with NIP-07 browser extension
export async function loginWithNip07(): Promise<NDKUser | null> {
  if (!hasNip07Extension()) {
    throw new Error("No Nostr extension found. Please install Alby or nos2x.");
  }

  const ndk = getNDK();
  const signer = new NDKNip07Signer();
  ndk.signer = signer;

  try {
    const user = await signer.user();
    await ndk.connect();
    return user;
  } catch (error) {
    console.error("Failed to login with NIP-07:", error);
    return null;
  }
}

// Get the current user from the signer
export async function getCurrentUser(): Promise<NDKUser | null> {
  const ndk = getNDK();
  if (!ndk.signer) return null;

  try {
    return await ndk.signer.user();
  } catch {
    return null;
  }
}

// Logout - clear the signer
export function logout(): void {
  const ndk = getNDK();
  ndk.signer = undefined;
}

// Type declaration for window.nostr (NIP-07)
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: object): Promise<object>;
      getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
      nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
      nip44?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
  }
}
