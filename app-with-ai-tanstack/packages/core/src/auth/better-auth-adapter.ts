/**
 * Better Auth database adapter using Kysely
 */

import type { Kysely } from "kysely";

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a Kysely adapter for Better Auth
 */
export function createKyselyAdapter(db: Kysely<any>): any {
  return {
    // User operations
    createUser: async (user: any) => {
      const newUser = await db
        .insertInto("auth_users")
        .values({
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returningAll()
        .executeTakeFirst();
      return newUser as AuthUser;
    },

    getUser: async (id: any) => {
      const user = await db
        .selectFrom("auth_users")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return user as AuthUser | undefined;
    },

    getUserByEmail: async (email: any) => {
      const user = await db
        .selectFrom("auth_users")
        .selectAll()
        .where("email", "=", email)
        .executeTakeFirst();
      return user as AuthUser | undefined;
    },

    updateUser: async (id: any, data: any) => {
      const updated = await db
        .updateTable("auth_users")
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      return updated as AuthUser;
    },

    deleteUser: async (id: any) => {
      await db.deleteFrom("auth_users").where("id", "=", id).execute();
    },

    // Session operations
    createSession: async (session: any) => {
      const newSession = await db
        .insertInto("auth_sessions")
        .values({
          id: session.id,
          userId: session.userId,
          token: session.token,
          expiresAt: session.expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returningAll()
        .executeTakeFirst();
      return newSession as AuthSession;
    },

    getSession: async (token: any) => {
      const session = await db
        .selectFrom("auth_sessions")
        .selectAll()
        .where("token", "=", token)
        .executeTakeFirst();
      return session as AuthSession | undefined;
    },

    updateSession: async (token: any, data: any) => {
      const updated = await db
        .updateTable("auth_sessions")
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where("token", "=", token)
        .returningAll()
        .executeTakeFirst();
      return updated as AuthSession;
    },

    deleteSession: async (token: any) => {
      await db.deleteFrom("auth_sessions").where("token", "=", token).execute();
    },

    // Account operations (for OAuth)
    createAccount: async (account: any) => {
      return await db.insertInto("auth_accounts").values(account).returningAll().executeTakeFirst();
    },

    getAccount: async (userId: any, provider: any) => {
      return await db
        .selectFrom("auth_accounts")
        .selectAll()
        .where("userId", "=", userId)
        .where("provider", "=", provider)
        .executeTakeFirst();
    },

    deleteAccount: async (userId: any, provider: any) => {
      await db
        .deleteFrom("auth_accounts")
        .where("userId", "=", userId)
        .where("provider", "=", provider)
        .execute();
    },

    // Verification token operations
    createVerificationToken: async (token: any) => {
      return await db
        .insertInto("auth_verification_tokens")
        .values(token)
        .returningAll()
        .executeTakeFirst();
    },

    getVerificationToken: async (token: any) => {
      return await db
        .selectFrom("auth_verification_tokens")
        .selectAll()
        .where("token", "=", token)
        .executeTakeFirst();
    },

    deleteVerificationToken: async (token: any) => {
      await db.deleteFrom("auth_verification_tokens").where("token", "=", token).execute();
    },
  };
}
