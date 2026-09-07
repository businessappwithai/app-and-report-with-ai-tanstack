import { createHash } from "node:crypto";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Kysely, sql } from "kysely";
import { KYSELY_CONNECTION } from "../../database/database.constants";

interface ImmudbVerifyResult {
  key: string;
  value: string;
  txId: string | number;
  verified: boolean;
}

interface ImmudbScanEntry {
  key: string;
  value: string;
}

/**
 * The tamper-evident audit ledger, on PostgreSQL-in-WASM.
 *
 * The server build of this application mirrors every audit event into immudb, a
 * separate append-only server that answers reads with a cryptographic proof.
 * An application that runs with no server has nowhere to put a second one, so
 * this keeps the same guarantee the same way immudb does — a hash chain — in a
 * table of its own, in the database the application already has.
 *
 * It is the one file the WASM overlay replaces. Everything else about the
 * backend is the same source, because everything else reaches the database
 * through `pg`, and the overlay substitutes that package instead of editing the
 * code that imports it. immudb could not be substituted the same way: it is not
 * a driver behind an interface, it is a second server.
 *
 * Each entry stores the hash of the one before it, and its own hash over
 * (previous hash, key, value). Changing any earlier entry changes every hash
 * after it, so `verifiedGet` can say whether a record is still the record that
 * was written. That is what the audit page's "verify" button reads.
 *
 * **What this is not.** immudb's real protection came from being somewhere
 * else: an attacker who owns the application database does not own the ledger.
 * Here they are the same database, so an attacker who can rewrite an audit row
 * can recompute the chain after it. This detects accidental and casual
 * tampering — an edited row, a deleted event, a restored backup that disagrees
 * with itself — and it does not detect a deliberate, informed rewrite. Point
 * IMMUDB_HOST at a real immudb and use the server build when that matters.
 *
 * The class name and its whole surface are unchanged, so `audit.service.ts`
 * and `audit.controller.ts` are the same files in both builds.
 */
@Injectable()
export class ImmudbService implements OnModuleInit {
  private readonly logger = new Logger(ImmudbService.name);
  private ready = false;
  private readonly enabled: boolean;

  constructor(
    @Inject(KYSELY_CONNECTION) private readonly db: Kysely<any>,
    private readonly config: ConfigService
  ) {
    this.enabled = config.get<string>("IMMUDB_ENABLED", "true") !== "false";
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        "Audit ledger disabled via IMMUDB_ENABLED=false — audit writes go to PostgreSQL only"
      );
      return;
    }

    try {
      const db = this.db;
      await sql`
        CREATE TABLE IF NOT EXISTS sys_audit_ledger (
          seq BIGSERIAL PRIMARY KEY,
          key VARCHAR(200) NOT NULL UNIQUE,
          value TEXT NOT NULL,
          prev_hash CHAR(64) NOT NULL,
          entry_hash CHAR(64) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `.execute(db);
      await sql`CREATE INDEX IF NOT EXISTS idx_sys_audit_ledger_key ON sys_audit_ledger(key)`.execute(db);

      this.ready = true;
      const { rows } = await sql<{ count: string }>`SELECT COUNT(*)::text AS count FROM sys_audit_ledger`.execute(db);
      this.logger.log(`Audit ledger ready (PGlite hash chain, ${rows[0]?.count ?? 0} entries)`);
    } catch (error) {
      this.logger.error(
        `Audit ledger could not be prepared: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.warn("Continuing without the ledger — audit writes go to PostgreSQL only");
      this.ready = false;
    }
  }

  get isConnected(): boolean {
    return this.ready;
  }

  /**
   * Append an entry and return its sequence number.
   *
   * Serialised through a transaction that reads the previous head: two audit
   * writes racing would otherwise both chain to the same predecessor and leave
   * a fork nothing can verify. Audit writes are already off the request path,
   * so the serialisation costs nothing anyone waits for.
   */
  async verifiedSet(key: string, value: string): Promise<string> {
    if (!this.ready) return key;
    try {
      return await this.db.transaction().execute(async (trx) => {
        const { rows } = await sql<{ entry_hash: string }>`
          SELECT entry_hash FROM sys_audit_ledger ORDER BY seq DESC LIMIT 1
        `.execute(trx);

        const prevHash = rows[0]?.entry_hash ?? GENESIS;
        const entryHash = chainHash(prevHash, key, value);

        const inserted = await sql<{ seq: string }>`
          INSERT INTO sys_audit_ledger (key, value, prev_hash, entry_hash)
          VALUES (${key}, ${value}, ${prevHash}, ${entryHash})
          RETURNING seq::text AS seq
        `.execute(trx);

        return inserted.rows[0]?.seq ?? key;
      });
    } catch (error) {
      this.logger.error(
        `Ledger append failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`
      );
      return key;
    }
  }

  /**
   * Read an entry and check it against the chain.
   *
   * `key` is what the audit row stored, which is the sequence number when the
   * append succeeded and the original key when it did not — so both are
   * accepted, exactly as the immudb client accepted a transaction id or a key.
   */
  async verifiedGet(key: string): Promise<ImmudbVerifyResult | null> {
    if (!this.ready) return null;
    try {
      const db = this.db;
      const { rows } = await sql<{
        seq: string;
        key: string;
        value: string;
        prev_hash: string;
        entry_hash: string;
      }>`
        SELECT seq::text AS seq, key, value, prev_hash, entry_hash
          FROM sys_audit_ledger
         WHERE key = ${key} OR seq::text = ${key}
         LIMIT 1
      `.execute(db);

      const entry = rows[0];
      if (!entry) return null;

      const recomputed = chainHash(entry.prev_hash, entry.key, entry.value);
      if (recomputed !== entry.entry_hash) {
        // The entry's own hash disagrees with its contents: the row was edited.
        return { key: entry.key, value: entry.value, txId: entry.seq, verified: false };
      }

      // And the link backwards: an entry can be internally consistent and still
      // be sitting on top of a predecessor that was removed or replaced.
      const previous = await sql<{ entry_hash: string }>`
        SELECT entry_hash FROM sys_audit_ledger WHERE seq < ${entry.seq}::bigint ORDER BY seq DESC LIMIT 1
      `.execute(db);
      const expectedPrev = previous.rows[0]?.entry_hash ?? GENESIS;

      return {
        key: entry.key,
        value: entry.value,
        txId: entry.seq,
        verified: expectedPrev === entry.prev_hash,
      };
    } catch (error) {
      this.logger.error(
        `Ledger read failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /** Entries whose key starts with `prefix`, oldest first. */
  async scan(prefix: string, limit = 100): Promise<ImmudbScanEntry[]> {
    if (!this.ready) return [];
    try {
      const { rows } = await sql<ImmudbScanEntry>`
        SELECT key, value FROM sys_audit_ledger
         WHERE key LIKE ${`${prefix}%`}
         ORDER BY seq ASC
         LIMIT ${limit}
      `.execute(this.db);
      return rows;
    } catch (error) {
      this.logger.error(
        `Ledger scan failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Walk the whole chain. Returns the first entry that does not verify, so an
   * operator can answer "has anything been tampered with" rather than only
   * "was this one record tampered with".
   */
  async verifyChain(): Promise<{ entries: number; brokenAt: string | null }> {
    if (!this.ready) return { entries: 0, brokenAt: null };
    const { rows } = await sql<{
      seq: string;
      key: string;
      value: string;
      prev_hash: string;
      entry_hash: string;
    }>`
      SELECT seq::text AS seq, key, value, prev_hash, entry_hash FROM sys_audit_ledger ORDER BY seq ASC
    `.execute(this.db);

    let expectedPrev = GENESIS;
    for (const entry of rows) {
      if (entry.prev_hash !== expectedPrev) return { entries: rows.length, brokenAt: entry.seq };
      if (chainHash(entry.prev_hash, entry.key, entry.value) !== entry.entry_hash) {
        return { entries: rows.length, brokenAt: entry.seq };
      }
      expectedPrev = entry.entry_hash;
    }
    return { entries: rows.length, brokenAt: null };
  }
}

/** The hash the first entry chains to. Any constant will do; this one is legible. */
const GENESIS = "0".repeat(64);

/**
 * The link. Lengths are part of the input so that ("ab", "c") and ("a", "bc")
 * cannot produce the same hash — without them, an attacker could move a
 * character across the boundary and leave the chain intact.
 */
function chainHash(prevHash: string, key: string, value: string): string {
  return createHash("sha256")
    .update(prevHash)
    .update(`|${key.length}|`)
    .update(key)
    .update(`|${value.length}|`)
    .update(value)
    .digest("hex");
}
