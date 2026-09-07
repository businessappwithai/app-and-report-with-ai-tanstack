import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  console.warn("[ENCRYPTION DEBUG] getKey() called");
  console.warn("[ENCRYPTION DEBUG] ENCRYPTION_KEY env variable exists:", !!encryptionKey);
  if (encryptionKey) {
    console.warn("[ENCRYPTION DEBUG] ENCRYPTION_KEY length:", encryptionKey.length, "characters");
    console.warn(
      "[ENCRYPTION DEBUG] ENCRYPTION_KEY is hex string:",
      /^[0-9a-fA-F]+$/.test(encryptionKey)
    );
  }

  if (!encryptionKey) {
    // For development, use a default key (DO NOT use in production)
    console.warn("[ENCRYPTION DEBUG] Using DEFAULT development key - NOT SECURE FOR PRODUCTION!");
    return crypto.scryptSync("default-dev-key-change-in-production", "salt", KEY_LENGTH);
  }

  // If the key is a hex string, convert it
  if (/^[0-9a-fA-F]+$/.test(encryptionKey)) {
    console.warn("[ENCRYPTION DEBUG] Converting hex string to Buffer");
    const key = Buffer.from(encryptionKey, "hex");
    console.warn("[ENCRYPTION DEBUG] Converted key length:", key.length, "bytes");
    return key;
  }

  // Otherwise, derive a key from the string
  console.warn("[ENCRYPTION DEBUG] Deriving key from string using scrypt");
  const key = crypto.scryptSync(encryptionKey, "salt", KEY_LENGTH);
  console.warn("[ENCRYPTION DEBUG] Derived key length:", key.length, "bytes");
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Encrypted data
  return iv.toString("hex") + authTag.toString("hex") + encrypted;
}

export function decrypt(ciphertext: string): string {
  // WARN: Log ciphertext properties for debugging
  console.warn("[ENCRYPTION DEBUG] Decrypt called with ciphertext length:", ciphertext.length);
  console.warn(
    "[ENCRYPTION DEBUG] Expected ciphertext format: IV(32 chars) + AuthTag(32 chars) + EncryptedData"
  );
  console.warn("[ENCRYPTION DEBUG] IV_LENGTH * 2 =", IV_LENGTH * 2, "chars");
  console.warn(
    "[ENCRYPTION DEBUG] (IV_LENGTH + AUTH_TAG_LENGTH) * 2 =",
    (IV_LENGTH + AUTH_TAG_LENGTH) * 2,
    "chars"
  );

  const key = getKey();
  console.warn("[ENCRYPTION DEBUG] Key length:", key.length, "bytes");
  console.warn("[ENCRYPTION DEBUG] Algorithm:", ALGORITHM);

  try {
    // Extract IV, AuthTag, and encrypted data
    if (ciphertext.length < (IV_LENGTH + AUTH_TAG_LENGTH) * 2) {
      console.error("[ENCRYPTION ERROR] Ciphertext is too short!");
      console.error("[ENCRYPTION ERROR] Ciphertext length:", ciphertext.length, "characters");
      console.error(
        "[ENCRYPTION ERROR] Minimum required length:",
        (IV_LENGTH + AUTH_TAG_LENGTH) * 2,
        "characters"
      );
      console.error(
        "[ENCRYPTION ERROR] Ciphertext (first 100 chars):",
        ciphertext.substring(0, 100)
      );
      throw new Error(
        `Invalid ciphertext length: ${ciphertext.length}. Expected at least ${(IV_LENGTH + AUTH_TAG_LENGTH) * 2} characters.`
      );
    }

    console.warn(
      "[ENCRYPTION DEBUG] Ciphertext length OK, proceeding to extract IV, AuthTag, and encrypted data"
    );

    const iv = Buffer.from(ciphertext.slice(0, IV_LENGTH * 2), "hex");
    console.warn("[ENCRYPTION DEBUG] IV extracted successfully, length:", iv.length, "bytes");

    const authTag = Buffer.from(
      ciphertext.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2),
      "hex"
    );
    console.warn(
      "[ENCRYPTION DEBUG] AuthTag extracted successfully, length:",
      authTag.length,
      "bytes"
    );

    const encrypted = ciphertext.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);
    console.warn(
      "[ENCRYPTION DEBUG] Encrypted data extracted, length:",
      encrypted.length,
      "characters"
    );

    console.warn("[ENCRYPTION DEBUG] Creating decipher with algorithm:", ALGORITHM);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    console.warn("[ENCRYPTION DEBUG] Starting decryption...");
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    console.warn(
      "[ENCRYPTION DEBUG] Decryption update successful, decrypted length:",
      decrypted.length
    );

    decrypted += decipher.final("utf8");
    console.warn(
      "[ENCRYPTION DEBUG] Decryption successful! Final plaintext length:",
      decrypted.length
    );
    console.warn("[ENCRYPTION DEBUG] Plaintext (first 200 chars):", decrypted.substring(0, 200));

    return decrypted;
  } catch (error) {
    console.error("[ENCRYPTION ERROR] Decryption failed!");
    console.error("[ENCRYPTION ERROR] Error:", error);
    if (error instanceof Error) {
      console.error("[ENCRYPTION ERROR] Error name:", error.name);
      console.error("[ENCRYPTION ERROR] Error message:", error.message);
      console.error("[ENCRYPTION ERROR] Error stack:", error.stack);
    }
    throw error;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(":");
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === verifyHash;
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}
