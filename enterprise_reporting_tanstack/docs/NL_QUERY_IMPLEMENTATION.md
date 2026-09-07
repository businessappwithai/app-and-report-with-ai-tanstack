# Natural Language Query (NL→SQL) Implementation Guide

## Overview

The NL→SQL system converts natural language questions into SQL queries with multiple layers of validation and safety checks. This document describes the complete implementation.

## Architecture

### 1. **NL→SQL Translation (OpenAI)**
- **File**: `src/lib/nlquery/openai-translator.ts`
- **Model**: GPT-4-turbo (temperature: 0.3 for deterministic responses)
- **Input**: Natural language question + database schema
- **Output**: SQL query + explanation + warnings

Key features:
- Structured output using Zod schemas
- Enforces SELECT-only queries
- Returns explanations and potential warnings
- Safe error handling with null fallbacks

**Usage**:
```typescript
import { translateNLToSQL } from "@/lib/nlquery/openai-translator";

const schema = await getSchemaMetadata(dataSource);
const translation = await translateNLToSQL(nlQuestion, schema);
// Returns { sql, explanation, warnings }
```

### 2. **Database Schema Extraction**
- **File**: `src/lib/nlquery/schema-metadata.ts`
- **Supports**: PostgreSQL and SQLite
- **Caching**: 1-hour TTL in-memory cache

Fetches:
- Table names and types (table/view)
- Column names and metadata
- Schema context for LLM prompts

**Usage**:
```typescript
import { getSchemaMetadata } from "@/lib/nlquery/schema-metadata";

const schema = await getSchemaMetadata(dataSource);
// Returns { tables: [{ name, type, columns }] }
```

### 3. **Query Validation Pipeline**

#### Step 1: OpenAI Translation
- Translates NL to SQL using GPT-4
- Validates SQL is a SELECT statement

#### Step 2: ANTLR Validation (D11)
- Keyword allowlist enforcement
- Forbidden keyword detection (DROP, DELETE, INSERT, etc.)
- Parentheses matching

#### Step 3: Translation Validation (D4)
- Reverse-translates SQL back to English
- Semantic similarity matching with original question
- Confidence threshold: ≥90% for auto-execute, <90% for approval

#### Step 4: RBAC Pre-flight Check (D5)
- Table-level access validation
- Column-level restrictions
- Row filter application

#### Step 5: Query Execution
- Executes against the datasource
- 30-second default timeout
- Result pagination (first 100 rows)

#### Step 6: OpenKB Logging (D20-D25)
- Stores successful queries with metadata
- Generates semantic embeddings for discovery
- Enables query auto-learning

## OpenKB Integration

### Knowledge Base Storage
- **Backend**: Redis (HSET for metadata/embeddings, ZSET for timestamps)
- **Embeddings**: Ollama (self-hosted, bge-small model)
- **Similarity**: Cosine similarity search

### Key Operations

**Logging a Query**:
```typescript
const openkb = await getOpenKBClient();
const queryId = await openkb.logQuery(roleId, {
  nlQuestion: "What is the total revenue?",
  generatedSQL: "SELECT SUM(amount) FROM orders",
  executionTimeMs: 125,
  resultRowCount: 1,
});
```

**Finding Similar Queries** (D24: Top 3):
```typescript
const similar = await openkb.findSimilar(roleId, proposedDefinition, 3);
// Returns: [{ nlQuestion, generatedSQL, similarity, ... }]
```

**Getting Recent Queries**:
```typescript
const recent = await openkb.getRecentQueries(roleId, 20);
```

## Environment Configuration

Required environment variables:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Redis (OpenKB backend)
REDIS_URL=redis://localhost:6379

# Ollama (Embedding service)
OLLAMA_URL=http://localhost:11434
```

## Setup Instructions

### 1. Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or Docker
docker run -d -p 11434:11434 ollama/ollama
```

### 2. Pull BGE Model for Embeddings

```bash
ollama pull bge-small
```

### 3. Setup Redis

```bash
# Docker
docker run -d -p 6379:6379 redis/redis-stack:latest

# Or local installation
brew install redis
redis-server
```

### 4. Configure Environment

```bash
# .env or environment variables
export OPENAI_API_KEY="your-key-here"
export REDIS_URL="redis://localhost:6379"
export OLLAMA_URL="http://localhost:11434"
```

## Server Functions

### Execute NL Query

```typescript
import { executeNLQuery } from "@/server-fns/nl-query";

const result = await executeNLQuery({
  nlQuestion: "How many orders in Q4?",
  dataSourceId: "ds_123",
  timeout: 30000,
});

// Returns:
// {
//   success: boolean,
//   sql?: string,
//   englishMeaning?: string,
//   confidence?: number,
//   requiresApproval?: boolean,
//   warning?: string,
//   rows?: Record<string, unknown>[],
//   error?: string,
//   rowCount?: number,
//   executionTime?: number
// }
```

### Execute with Override (Manager approval)

```typescript
import { executeNLQueryWithOverride } from "@/server-fns/nl-query";

const result = await executeNLQueryWithOverride({
  nlQuestion: "...",
  dataSourceId: "ds_123",
  approvedSQL: "SELECT ...",
});
```

## Audit Logging

All operations are logged to the audit table:
- `nl_query_generated` - Translation completed
- `nl_query_executed` - Query executed successfully
- `nl_query_error` - Translation or execution failed
- `nl_query_override` - Manager override
- `query_access_denied` - RBAC check failed

Fields:
- `userId` - Acting user
- `action` - Operation type
- `resourceType` - "query"
- `resourceId` - Data source ID
- `details` - Query metadata, confidence, results

## Confidence Scoring

Translation confidence is assessed by:
1. Semantic similarity: How well reverse-translation matches original question
2. Named entity matching: Key terms preserved in translation
3. Keyword overlap: Domain-specific vocabulary coverage

**Thresholds (D3)**:
- ≥90%: Auto-execute
- <90%: Warn and require manager approval

## Testing

### Unit Tests

Schema extraction:
```typescript
const schema = await getSchemaMetadata(testDataSource);
expect(schema.tables).toBeDefined();
expect(schema.tables[0].columns).toBeDefined();
```

Translation:
```typescript
const translation = await translateNLToSQL(
  "Select all customers",
  testSchema
);
expect(translation.sql).toContain("SELECT");
```

### E2E Tests

See `e2e/nl-query.spec.ts` for full pipeline testing with sample managers.

## Performance Considerations

### Caching
- Schema metadata cached for 1 hour
- Embedding results cached in-memory (max 1000)

### Timeouts
- Default query timeout: 30 seconds
- OpenAI API timeout: 30 seconds (configurable)

### Scaling
- Use Redis Cluster for multi-node deployments
- Scale Ollama using standalone instances
- PostgreSQL connection pooling configured

## Security Notes

1. **SQL Injection**: Multi-layer validation (ANTLR + reverse-translation + RBAC)
2. **Data Access**: RBAC checks enforce table and column permissions
3. **Credential Management**: Connection strings encrypted at rest
4. **Audit Trail**: All operations logged for compliance

## Common Issues

### OpenAI Integration
**Issue**: "OPENAI_API_KEY not set"
- Solution: Set `OPENAI_API_KEY` environment variable

### Redis Connection
**Issue**: "Connection to Redis failed"
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_URL` environment variable

### Ollama Service
**Issue**: "Ollama not available"
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Ensure bge-small model is pulled: `ollama list`

## Future Improvements

1. **Model Optimization**: Fine-tuned models for specific domains
2. **Caching Layer**: Vector database (Pinecone, Weaviate) for scalable similarity search
3. **Query Optimization**: Automatic EXPLAIN plan analysis and suggestions
4. **User Feedback Loop**: Rating system to improve model accuracy
5. **Multi-language**: Support for non-English natural language
