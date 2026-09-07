import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
 * immudb client wrapper.
 *
 * Uses immudb-node (gRPC client). Falls back to no-op when
 * IMMUDB_ENABLED=false so the app runs without immudb in dev/CI.
 */
@Injectable()
export class ImmudbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImmudbService.name);
  private client: any = null;
  private enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = config.get<string>("IMMUDB_ENABLED", "true") !== "false";
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        "immudb disabled via IMMUDB_ENABLED=false — audit writes go to PostgreSQL only"
      );
      return;
    }

    try {
      // immudb-node is an optional dependency. The specifier is held in a
      // variable so TypeScript does not try to resolve it: a literal needs a
      // suppression comment, and that comment is itself an error once the
      // package *is* installed, so the project failed to compile either way.
      const moduleName = "immudb-node";
      const ImmudbClient = (await import(moduleName)).default;

      const host = this.config.get<string>("IMMUDB_HOST", "127.0.0.1");
      const port = this.config.get<number>("IMMUDB_PORT", 8088);

      this.client = new ImmudbClient({ host, port, rootPath: "/tmp/immudb-root" });

      await this.client.login({
        user: this.config.get<string>("IMMUDB_USER", "immudb"),
        password: this.config.get<string>("IMMUDB_PASSWORD", "immudb"),
      });

      const db = this.config.get<string>("IMMUDB_DATABASE", "defaultdb");
      await this.client.useDatabase({ databasename: db }).catch(() => {
        // Database may already be selected; ignore
      });

      this.logger.log(`immudb connected at ${host}:${port} (db: ${db})`);
    } catch (err) {
      this.logger.error(
        `immudb connection failed: ${err instanceof Error ? err.message : String(err)}`
      );
      this.logger.warn(
        "Continuing without immudb — set IMMUDB_ENABLED=false to suppress this warning"
      );
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        // Ignore logout errors on shutdown
      }
    }
  }

  get isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Write a key-value pair with cryptographic verification.
   * Returns the immudb transaction ID (or key if tx unavailable).
   */
  async verifiedSet(key: string, value: string): Promise<string> {
    if (!this.client) return key;
    try {
      const result = await this.client.verifiedSet({ key, value });
      return String(result?.id ?? result?.index ?? key);
    } catch (err) {
      this.logger.error(
        `immudb verifiedSet failed for key ${key}: ${err instanceof Error ? err.message : String(err)}`
      );
      return key;
    }
  }

  /**
   * Read and verify a key. Returns null when key not found or immudb unavailable.
   */
  async verifiedGet(key: string): Promise<ImmudbVerifyResult | null> {
    if (!this.client) return null;
    try {
      const result = await this.client.verifiedGet({ key });
      return {
        key: result.key ?? key,
        value: result.value ?? "",
        txId: result.id ?? result.index ?? "",
        verified: true,
      };
    } catch (err: any) {
      if (err?.clientErr === "proof") {
        return { key, value: "", txId: "", verified: false };
      }
      this.logger.error(
        `immudb verifiedGet failed for key ${key}: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  /**
   * Scan entries by prefix. Used to query audit events by time range.
   */
  async scan(prefix: string, limit = 100): Promise<ImmudbScanEntry[]> {
    if (!this.client) return [];
    try {
      const result = await this.client.scan({ seekKey: prefix, prefix, limit, desc: false });
      return (result?.entries ?? []).map((e: any) => ({ key: e.key, value: e.value }));
    } catch (err) {
      this.logger.error(`immudb scan failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
}
