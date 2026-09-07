/**
 * Migration: Add Better Auth Tables
 *
 * Creates the necessary tables for Better Auth integration.
 * Better Auth will create its own tables, but we need to ensure
 * the database supports UUID extensions and has the proper structure.
 */

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension if not already enabled
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Better Auth creates its own tables, but we need to ensure
  // our ad_user table is compatible with Better Auth's user table
  // For now, we'll create a separate better_auth_users table
  // and create a view that maps ad_user to better_auth_users

  // Create better_auth_users table
  await knex.schema.createTable("better_auth_users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("email", 255).notNullable().unique();
    table.boolean("email_verified").defaultTo(false);
    table.string("name", 255);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

  // Create better_auth_sessions table
  await knex.schema.createTable("better_auth_sessions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .references("id")
      .inTable("better_auth_users")
      .notNullable()
      .onDelete("CASCADE");
    table.timestamp("expires_at").notNullable();
    table.string("token", 255).notNullable().unique();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });

  // Create better_auth_accounts table (for social login)
  await knex.schema.createTable("better_auth_accounts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .references("id")
      .inTable("better_auth_users")
      .notNullable()
      .onDelete("CASCADE");
    table.string("account_id", 255).notNullable();
    table.string("provider_id", 255).notNullable();
    table.text("access_token");
    table.text("refresh_token");
    table.text("id_token");
    table.timestamp("expires_at");
    table.string("password_hash"); // For email/password auth
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    table.unique(["account_id", "provider_id"]);
  });

  // Create better_auth_verification table (for email verification and password reset)
  await knex.schema.createTable("better_auth_verification", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("identifier", 255).notNullable();
    table.string("value", 255).notNullable();
    table.timestamp("expires_at").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // Create indexes for better performance
  await knex.raw("CREATE INDEX idx_sessions_user_id ON better_auth_sessions(user_id)");
  await knex.raw("CREATE INDEX idx_sessions_token ON better_auth_sessions(token)");
  await knex.raw("CREATE INDEX idx_sessions_expires_at ON better_auth_sessions(expires_at)");
  await knex.raw("CREATE INDEX idx_accounts_user_id ON better_auth_accounts(user_id)");
  await knex.raw("CREATE INDEX idx_verification_expires ON better_auth_verification(expires_at)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("better_auth_verification");
  await knex.schema.dropTableIfExists("better_auth_accounts");
  await knex.schema.dropTableIfExists("better_auth_sessions");
  await knex.schema.dropTableIfExists("better_auth_users");
}
