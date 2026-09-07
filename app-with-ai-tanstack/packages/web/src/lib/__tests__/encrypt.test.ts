import { beforeEach, describe, expect, it } from "vitest";
import { decryptConnectionString, encryptConnectionString } from "../encrypt";

describe("encrypt/decrypt connection string", () => {
  beforeEach(() => {
    // 32 bytes of zeros base64-encoded for testing
    process.env.DB_ENCRYPTION_KEY = Buffer.alloc(32).toString("base64");
  });

  it("round-trips a connection string", () => {
    const original = "mysql://user:pass@localhost:3306/mydb";
    const encrypted = encryptConnectionString(original);
    expect(encrypted).not.toBe(original);
    const decrypted = decryptConnectionString(encrypted);
    expect(decrypted).toBe(original);
  });

  it("throws on wrong key", () => {
    const original = "mysql://user:pass@localhost:3306/mydb";
    const encrypted = encryptConnectionString(original);
    process.env.DB_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    expect(() => decryptConnectionString(encrypted)).toThrow();
  });

  it("throws when DB_ENCRYPTION_KEY is not set", () => {
    delete process.env.DB_ENCRYPTION_KEY;
    expect(() => encryptConnectionString("test")).toThrow("DB_ENCRYPTION_KEY is not set");
  });
});
