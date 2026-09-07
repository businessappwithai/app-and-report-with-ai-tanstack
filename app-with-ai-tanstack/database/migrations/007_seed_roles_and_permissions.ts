/**
 * Migration: Seed Default Roles and Permissions
 *
 * Creates the default roles and permissions for the HMS system.
 * This migration populates the ad_role table with the predefined roles.
 */

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Insert default roles
  const roles = [
    {
      ad_role_id: knex.raw("gen_random_uuid()"),
      name: "admin",
      description: "Full system access",
      is_manual: false,
    },
    {
      ad_role_id: knex.raw("gen_random_uuid()"),
      name: "doctor",
      description: "Clinical access - can view and edit patient records",
      is_manual: false,
    },
    {
      ad_role_id: knex.raw("gen_random_uuid()"),
      name: "nurse",
      description: "Clinical access with limited edit capabilities",
      is_manual: false,
    },
    {
      ad_role_id: knex.raw("gen_random_uuid()"),
      name: "receptionist",
      description: "Front desk access - patient registration and appointments",
      is_manual: false,
    },
    {
      ad_role_id: knex.raw("gen_random_uuid()"),
      name: "billing",
      description: "Financial access - invoices and payments",
      is_manual: false,
    },
    {
      ad_role_id: knex.raw("gen_random_uuid()"),
      name: "readonly",
      description: "Read-only access to all data",
      is_manual: false,
    },
  ];

  await knex("ad_role").insert(roles);

  console.log("Seeded default roles");
}

export async function down(knex: Knex): Promise<void> {
  await knex("ad_role")
    .whereIn("name", ["admin", "doctor", "nurse", "receptionist", "billing", "readonly"])
    .delete();

  console.log("Removed default roles");
}
