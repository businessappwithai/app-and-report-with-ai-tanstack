# Audit Trail Enhancement Guide — immudb Integration

## Overview

This guide describes the complete audit trail architecture for APPWITHAI-generated applications. The system uses **immudb** for tamper-proof immutable audit storage combined with **PostgreSQL** for fast search and filtering.

Every mutation in the system (create, update, delete, login, config change, AI action) is recorded as an immutable cryptographically-verifiable event. The admin UI exposes full-text search, multi-field filtering, and per-record tamper verification.

---

## Architecture

```
Request → NestJS Controller
              ↓
         AuditInterceptor (wraps handler)
              ↓
         Handler executes (reads BEFORE value if needed)
              ↓
         Handler returns AFTER value
              ↓
         AuditInterceptor.tap()
              │
              ├─→ immudb.verifiedSet(key, json)   ← tamper-proof, immutable
              │         returns tx_id / index
              │
              └─→ PostgreSQL audit_log INSERT      ← fast search, stores immudb_key
```

### Why dual-store?

| Concern | immudb | PostgreSQL |
|---------|--------|-----------|
| Tamper-proof | ✅ Cryptographic proof via Merkle tree | ❌ Mutable |
| Fast search & filter | ❌ Prefix scan only | ✅ Indexed SQL queries |
| Before/after diff | ✅ Full JSON value | ✅ Full JSONB columns |
| Compliance evidence | ✅ `verifiedGet` produces mathematical proof | ❌ |
| Admin UI queries | ❌ Too slow for UI | ✅ Sub-100ms |

**Pattern**: Write to immudb first → store the returned `immudb_key` in PostgreSQL → admin UI queries PostgreSQL → "Verify" button calls `verifiedGet` on immudb for tamper proof.

---

## What Gets Audited

### Authentication
| Event | Action constant | Trigger |
|-------|----------------|---------|
| Login | `AUTH_LOGIN` | POST /api/auth/login |
| Logout | `AUTH_LOGOUT` | POST /api/auth/logout |
| Failed login | `AUTH_LOGIN_FAILED` | Failed auth |
| Password reset | `AUTH_PASSWORD_RESET` | POST /api/auth/reset-password |
| Session expired | `AUTH_SESSION_EXPIRED` | Guard rejection |

### Business Entity (bus_* tables)
| Event | Action constant |
|-------|----------------|
| Create | `ENTITY_CREATE` |
| Update | `ENTITY_UPDATE` |
| Delete | `ENTITY_DELETE` |
| Bulk import | `ENTITY_BULK_CREATE` |

### System Configuration (sys_* tables)
| Event | Action constant |
|-------|----------------|
| Field updated | `SYS_FIELD_UPDATE` |
| Field group created/updated | `SYS_FIELD_GROUP_CHANGE` |
| Table created/updated | `SYS_TABLE_CHANGE` |
| Window/tab change | `SYS_WINDOW_CHANGE` |

### AI Agent Actions (future)
| Event | Action constant |
|-------|----------------|
| SQL generated | `AI_SQL_GENERATED` |
| SQL executed | `AI_SQL_EXECUTED` |
| Report generated | `AI_REPORT_GENERATED` |
| Workflow approved | `AI_WORKFLOW_APPROVED` |
| Workflow rejected | `AI_WORKFLOW_REJECTED` |

---

## Audit Event Schema

```typescript
interface AuditEvent {
  // Identity
  id: string;               // UUID
  immudb_key: string;       // Key stored in immudb: "audit:{ts}:{id}"

  // When
  timestamp: string;        // ISO-8601 UTC

  // Who
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  session_id: string | null;

  // What
  action: string;           // ENTITY_CREATE, AUTH_LOGIN, etc.
  entity_type: string | null; // customer, invoice, etc.
  entity_id: string | null;

  // Change data
  before_value: object | null;  // Snapshot before mutation
  after_value: object | null;   // Snapshot after mutation
  changed_fields: string[];     // ["name", "status", "amount"]

  // Context
  ip_address: string | null;
  user_agent: string | null;
  source: 'WEB_UI' | 'API' | 'AGENT' | 'SYSTEM';
  request_id: string | null;
  correlation_id: string | null;

  // Outcome
  success: boolean;
  error_message: string | null;
}
```

### Sensitive Field Masking

Fields in this list are masked before storage:
- `password`, `password_hash`
- `token`, `access_token`, `refresh_token`, `api_key`
- `credit_card`, `card_number`, `cvv`
- `ssn`, `national_id`
- `secret`, `private_key`

Masking format: `"[REDACTED]"` for the field value.

---

## immudb Key Strategy

```
audit:{timestamp-ms}:{uuid}

Example:
audit:1718189700000:a3f4c2d1-8b9e-4f2a-b5d6-7e8f9a0b1c2d
```

This key format enables:
- **Time-range scans**: `scan({ prefix: 'audit:171818', limit: 100 })`
- **Full history**: `history({ key: 'audit:{ts}:{id}' })`
- **Uniqueness**: UUID suffix prevents collisions on same-millisecond writes

The `immudb_key` is stored in PostgreSQL so you can always look up the immudb entry from an audit record to verify it.

---

## Database Migration

```sql
CREATE TABLE audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  immudb_key        VARCHAR(200),
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id           VARCHAR(200),
  user_name         VARCHAR(200),
  user_email        VARCHAR(200),
  session_id        VARCHAR(200),
  action            VARCHAR(100) NOT NULL,
  entity_type       VARCHAR(100),
  entity_id         VARCHAR(200),
  before_value      JSONB,
  after_value       JSONB,
  changed_fields    TEXT[]      DEFAULT '{}',
  ip_address        VARCHAR(45),
  user_agent        TEXT,
  source            VARCHAR(50)  DEFAULT 'WEB_UI',
  success           BOOLEAN     NOT NULL DEFAULT TRUE,
  error_message     TEXT,
  request_id        VARCHAR(200),
  correlation_id    VARCHAR(200),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_timestamp   ON audit_log (timestamp DESC);
CREATE INDEX idx_audit_user_id     ON audit_log (user_id);
CREATE INDEX idx_audit_action      ON audit_log (action);
CREATE INDEX idx_audit_entity_type ON audit_log (entity_type);
CREATE INDEX idx_audit_entity_id   ON audit_log (entity_id);
CREATE INDEX idx_audit_success     ON audit_log (success);
```

---

## NestJS Module Structure

```
src/modules/audit/
├── audit.module.ts          — registers providers, exports AuditService
├── audit.types.ts           — AuditEvent interface + action constants
├── immudb.service.ts        — immudb connection + verifiedSet/verifiedGet/scan
├── audit.service.ts         — log(), search(), verify() methods
├── audit.interceptor.ts     — HTTP interceptor for auto-capture
└── audit.controller.ts      — GET /audit with search/filter + GET /audit/:id/verify
```

### Environment Variables

```env
IMMUDB_HOST=127.0.0.1
IMMUDB_PORT=3322
IMMUDB_USER=immudb
IMMUDB_PASSWORD=immudb
IMMUDB_DATABASE=defaultdb
IMMUDB_ENABLED=true   # set false to disable immudb (writes go to PG only)
```

---

## Admin Search UI

The audit admin page (`/admin/audit`) provides:

### Filters
- **Date range** — from/to datetime pickers
- **User** — free text (email/name)
- **Action** — dropdown (all actions, or filter by category: Auth / Entity / System / AI)
- **Entity type** — dropdown (auto-populated from distinct values in audit_log)
- **Entity ID** — free text
- **Source** — WEB_UI / API / AGENT / SYSTEM
- **Success** — All / Success only / Failures only

### Table columns
| Column | Notes |
|--------|-------|
| Timestamp | Sortable, formatted as local time |
| User | Email + name |
| Action | Colour-coded badge |
| Entity | Type + ID, links to entity detail if exists |
| Changed Fields | Comma-separated list |
| Source | Badge |
| Status | ✅ / ❌ |
| Verify | Button → calls immudb verifiedGet, shows proof result |

### Detail Drawer
Clicking a row opens a side drawer showing:
- Full before/after JSON diff (highlighted)
- Full immudb proof (tx_id, tx_hash, signature)
- IP address, user agent, request ID

---

## Performance Notes

- immudb writes are **fire-and-forget** (async, non-blocking) — API response is not delayed
- PostgreSQL is the query path — admin UI never hits immudb for list/filter
- immudb is only called when the "Verify" button is clicked for a specific record
- Recommended retention: Keep last 12 months in `audit_log`; archive older rows to cold storage (immudb remains authoritative for verification)

---

## Running immudb Locally

```bash
# Docker (fastest)
docker run -d --name immudb \
  -p 3322:3322 \
  -p 9497:9497 \
  codenotary/immudb:latest

# Verify it's running
docker logs immudb
# Should show: "immudb is listening on port 3322"
```

Default credentials: `immudb` / `immudb`

For production, use immudb Cloud (https://immudb.io/immudb-cloud/) or a managed deployment.
