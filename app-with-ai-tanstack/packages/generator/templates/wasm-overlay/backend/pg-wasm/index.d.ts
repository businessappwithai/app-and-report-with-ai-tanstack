/**
 * Types for the WebAssembly `pg`.
 *
 * These are not a description of what the real `pg` can do — they are the exact
 * shape Kysely's `PostgresDialect` asks a pool for, mirrored structurally so
 * that `new PostgresDialect({ pool: new Pool(...) })` type-checks in the
 * generated backend without that backend importing anything new.
 *
 * Mirrored rather than imported: a driver that depended on Kysely to describe
 * itself would be a strange thing, and the shapes are twelve lines. They are
 * copied from kysely's `postgres-dialect-config.d.ts`;
 * `command` in particular is a literal union there, and declaring it `string`
 * here is what made every file that builds a pool fail to compile.
 */

export interface QueryResult<R = any> {
  command: "UPDATE" | "DELETE" | "INSERT" | "SELECT" | "MERGE";
  rowCount: number;
  rows: R[];
  fields: unknown[];
}

export interface Cursor<T = any> {
  read(rowsCount: number): Promise<T[]>;
  close(): Promise<void>;
}

export interface PoolConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  max?: number;
  ssl?: unknown;
  [key: string]: unknown;
}

export declare class Client {
  constructor(config?: PoolConfig);
  connect(): Promise<Client>;
  query<R = any>(sql: string, parameters?: ReadonlyArray<unknown>): Promise<QueryResult<R>>;
  query<R = any>(cursor: Cursor<R>): Cursor<R>;
  query<R = any>(config: { text: string; values?: unknown[] }): Promise<QueryResult<R>>;
  release(): void;
  end(): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

export declare class Pool {
  constructor(config?: PoolConfig);
  connect(): Promise<Client>;
  end(): Promise<void>;
  query<R = any>(sql: string, parameters?: ReadonlyArray<unknown>): Promise<QueryResult<R>>;
  on(event: string, listener: (...args: unknown[]) => void): this;
  readonly totalCount: number;
  readonly idleCount: number;
  readonly waitingCount: number;
}

/** Constructing one throws: an embedded Postgres has no cursor to stream from. */
export declare class CursorConstructor {
  constructor(...args: unknown[]);
}
export { CursorConstructor as Cursor };

/** Close the embedded server. Tests and graceful exit, not request paths. */
export declare function shutdown(): Promise<void>;

/** Where PGlite keeps its files: PGLITE_DATA_DIR, then DATABASE_URL, then ./pgdata. */
export declare function resolveDataDir(): string;

export declare const types: {
  setTypeParser(...args: unknown[]): void;
  getTypeParser(...args: unknown[]): (value: unknown) => unknown;
};
export declare function escapeIdentifier(value: string): string;
export declare function escapeLiteral(value: string): string;
