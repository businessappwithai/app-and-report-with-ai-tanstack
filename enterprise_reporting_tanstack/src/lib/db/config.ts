import { closeDb, getConfigDB, getDb, isPostgres, waitForDatabaseReady, type KyselyDB } from "./kysely-db";

export type { KyselyDB };
// Re-export Kysely DB functions
export { closeDb, getConfigDB, getDb, isPostgres, waitForDatabaseReady };
