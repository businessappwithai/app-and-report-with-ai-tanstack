/**
 * Better Auth Configuration
 * Shared configuration for both NestJS and OData V4 stacks
 */

import { betterAuth } from "better-auth";
import type { AuthOptions } from "./auth.types.js";

/**
 * Default role definitions for the system
 */
export const DEFAULT_ROLES = [
  {
    name: "admin",
    description: "Full system access",
    permissions: ["*"], // Wildcard for all permissions
  },
  {
    name: "doctor",
    description: "Clinical access",
    permissions: [
      "patient:read",
      "patient:update:clinical",
      "appointment:read",
      "appointment:create",
      "appointment:update",
      "prescription:read",
      "prescription:create",
      "prescription:update",
    ],
  },
  {
    name: "nurse",
    description: "Clinical access with limited edit",
    permissions: [
      "patient:read",
      "patient:update:vitals",
      "appointment:read",
      "appointment:update",
      "prescription:read",
    ],
  },
  {
    name: "receptionist",
    description: "Front desk access",
    permissions: [
      "patient:read",
      "patient:create",
      "patient:update:basic",
      "appointment:read",
      "appointment:create",
      "appointment:update",
      "invoice:read",
      "invoice:create",
    ],
  },
  {
    name: "billing",
    description: "Financial access",
    permissions: [
      "patient:read",
      "invoice:read",
      "invoice:create",
      "invoice:update",
      "payment:read",
      "payment:create",
      "payment:update",
    ],
  },
  {
    name: "readonly",
    description: "Read-only access",
    permissions: ["*:read"],
  },
] as const;

/**
 * Entity operation mappings to permissions
 */
export const ENTITY_PERMISSIONS: Record<string, string[]> = {
  patient: ["patient:read", "patient:create", "patient:update", "patient:delete"],
  appointment: [
    "appointment:read",
    "appointment:create",
    "appointment:update",
    "appointment:delete",
  ],
  prescription: [
    "prescription:read",
    "prescription:create",
    "prescription:update",
    "prescription:delete",
  ],
  invoice: ["invoice:read", "invoice:create", "invoice:update", "invoice:delete"],
  payment: ["payment:read", "payment:create", "payment:update", "payment:delete"],
};

/**
 * Create Better Auth instance with configuration
 *
 * This function should be called in each stack (NestJS module, OData middleware)
 * with the appropriate database adapter.
 *
 * @param options - Auth options
 * @returns Better Auth instance
 */
export function createBetterAuth(options: AuthOptions) {
  return betterAuth({
    database: options.database,
    baseURL: options.baseURL,
    secret: options.secret,

    // Email and password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }: { user: any; url: any }) => {
        // Implement email sending logic
        console.log("Password reset requested for:", user.email, url);
      },
      sendVerificationEmail: async ({ user, url }: { user: any; url: any }) => {
        // Implement email verification logic
        console.log("Verification email sent to:", user.email, url);
      },
    },

    // Social login providers (optional)
    socialProviders: options.socialProviders?.reduce(
      (acc, provider) => {
        acc[provider] = {
          enabled: true,
          clientId: process.env[`${provider.toUpperCase()}_CLIENT_ID`] ?? "",
          clientSecret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] ?? "",
        };
        return acc;
      },
      {} as Record<string, { enabled: boolean; clientId: string; clientSecret: string }>
    ),

    // Session configuration
    session: {
      expiresIn: options.sessionMaxAge ?? 60 * 60 * 24 * 7, // 7 days default
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },

    // Advanced security settings
    advanced: {
      cookiePrefix: "better-auth",
      crossSubDomainCookies: {
        enabled: false, // Set to true if using subdomains
      },
      useSecureCookies: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },

    // Account settings
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: options.socialProviders ?? [],
      },
    },

    // Two-factor authentication (optional, per role)
    twoFactor: {
      enabled: false, // Can be enabled per role
    },

    // Rate limiting (recommended for production)
    rateLimit: {
      window: 60, // 60 seconds
      max: 10, // 10 requests per window
    },
  });
}

/**
 * Validate auth options
 */
export function validateAuthOptions(options: AuthOptions): void {
  if (!options.secret) {
    throw new Error("BETTER_AUTH_SECRET is required");
  }

  if (!options.baseURL) {
    throw new Error("BETTER_AUTH_URL is required");
  }

  if (!options.database) {
    throw new Error("Database connection is required");
  }

  if (options.secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
  }
}
