/**
 * Knex.js configuration for APPWITHAI generator migrations
 * Uses MariaDB/MySQL via mysql2 driver.
 * Connection reads the same env vars as the core db.config.ts.
 */

import type { Knex } from "knex";

function buildConnection() {
  const url = process.env.DATABASE_URL;
  if (url && (url.startsWith("mysql://") || url.startsWith("mariadb://"))) {
    return url.replace(/^mariadb:\/\//, "mysql://");
  }
  return {
    host: process.env.MARIADB_HOST ?? "127.0.0.1",
    port: Number(process.env.MARIADB_PORT ?? 3306),
    user: process.env.MARIADB_USER ?? "appwithai",
    password: process.env.MARIADB_PASSWORD ?? "",
    database: process.env.MARIADB_DATABASE ?? "appwithai",
  };
}

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "mysql2",
    connection: buildConnection(),
    migrations: {
      directory: "./database/migrations",
      extension: "ts",
    },
    seeds: {
      directory: "./database/seeds",
    },
  },

  production: {
    client: "mysql2",
    connection: buildConnection(),
    migrations: {
      directory: "./database/migrations",
      extension: "ts",
    },
  },
};

export default config;
