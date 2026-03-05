import crypto from "crypto";

// Get the master encryption key from environment
function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_MASTER_KEY;
  if (!keyHex) {
    throw new Error("ENCRYPTION_MASTER_KEY environment variable is not set");
  }
  return Buffer.from(keyHex, "hex");
}

// Derive a per-user key from the master key and user ID
export function deriveUserKey(userId: string): Buffer {
  const masterKey = getMasterKey();
  // Use HKDF for proper key derivation
  return crypto.hkdfSync("sha256", masterKey, userId, "encryption", 32);
}

// Encrypt a string value using AES-256-GCM
export function encrypt(plaintext: string, userId: string): string {
  const key = deriveUserKey(userId);
  const nonce = crypto.randomBytes(12); // 96-bit nonce for AES-GCM

  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Return nonce + authTag + ciphertext as hex
  const combined = Buffer.concat([nonce, authTag, encrypted]);
  return combined.toString("hex");
}

// Decrypt a string value
export function decrypt(encryptedHex: string, userId: string): string {
  const key = deriveUserKey(userId);
  const combined = Buffer.from(encryptedHex, "hex");

  const nonce = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// Encrypt a number (for balances)
export function encryptNumber(value: number, userId: string): string {
  return encrypt(value.toString(), userId);
}

// Decrypt a number
export function decryptNumber(encryptedHex: string, userId: string): number {
  const decrypted = decrypt(encryptedHex, userId);
  return parseFloat(decrypted);
}

// Generate a random encryption key (for initial setup)
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
