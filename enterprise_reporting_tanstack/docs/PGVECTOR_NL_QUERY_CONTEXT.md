# pgvector NL Query Context System

## Overview

The NL Query system now uses PostgreSQL's pgvector extension to store and retrieve successful natural language to SQL translations. This enables role-aware learning where the system improves over time by learning from successful queries executed by users in each role.

## Architecture

### Data Flow

```
User Question
    ↓
Fetch Schema + Field Instructions + RBAC Context
    ↓
Query pgvector for similar successful queries from same role
    ↓
Build Enhanced Prompt with Context
    ↓
Send to Mastra Agent (with rich context) or Ollama
    ↓
Generate SQL
    ↓
Validate & Check RBAC
    ↓
Execute Query
    ↓
Store in pgvector for Future Reference
```

## Database Schema

### 1. nl_query_context Table

Stores successful NL→SQL translations with full context:

```sql
CREATE TABLE nl_query_context (
  id UUID PRIMARY KEY,
  
  -- Query Identification
  data_source_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role_name VARCHAR NOT NULL,
  
  -- Natural Language & Generated SQL
  nl_question TEXT NOT NULL,
  generated_sql TEXT NOT NULL,
  nl_question_embedding VECTOR(1536),  -- pgvector embedding
  
  -- Execution Context
  schema_context JSONB NOT NULL,      -- tables, columns, descriptions
  rbac_context JSONB NOT NULL,         -- roles, permissions
  field_instructions JSONB,             -- field hints
  
  -- Execution Metadata
  execution_time_ms INTEGER,
  row_count INTEGER,
  was_successful BOOLEAN,
  error_message TEXT,
  
  -- Confidence Scores
  translation_confidence DECIMAL(3,2),
  llm_confidence DECIMAL(3,2),
  
  -- Query Characteristics
  query_type VARCHAR,                  -- SELECT, JOIN, AGGREGATE, etc.
  table_count INTEGER,
  join_count INTEGER,
  has_aggregation BOOLEAN,
  has_window_function BOOLEAN,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP
);

CREATE INDEX ON nl_query_context 
USING ivfflat (nl_question_embedding vector_cosine_ops);
```

### 2. nl_query_role_stats Table

Tracks per-role statistics:

```sql
CREATE TABLE nl_query_role_stats (
  id UUID PRIMARY KEY,
  
  role_name VARCHAR NOT NULL,
  data_source_id UUID NOT NULL,
  
  -- Statistics
  total_queries INTEGER,
  successful_queries INTEGER,
  failed_queries INTEGER,
  success_rate DECIMAL(5,2),
  
  -- Performance Metrics
  avg_execution_time_ms DECIMAL(10,2),
  avg_rows_returned DECIMAL(10,2),
  avg_confidence DECIMAL(3,2),
  
  -- Query Patterns
  common_query_types JSONB,  -- {SELECT: 45, JOIN: 30, AGGREGATE: 25}
  common_tables JSONB,        -- {customers: 50, orders: 40, ...}
  common_joins JSONB,         -- {customers.id = orders.customer_id: 30}
  
  updated_at TIMESTAMP,
  
  UNIQUE(role_name, data_source_id)
);
```

### 3. nl_query_feedback Table

Enables continuous improvement:

```sql
CREATE TABLE nl_query_feedback (
  id UUID PRIMARY KEY,
  
  nl_query_context_id UUID REFERENCES nl_query_context(id),
  
  feedback_type VARCHAR,  -- accurate, needs_refinement, incorrect
  user_feedback TEXT,
  corrected_sql TEXT,
  
  feedback_by UUID REFERENCES users(id),
  created_at TIMESTAMP
);
```

## Core Services

### nl-query-context-service.ts

**Key Functions:**

#### 1. storeNLQueryContext()
```typescript
interface NLQueryContextInput {
  dataSourceId: string;
  userId: string;
  roleName: string;
  nlQuestion: string;
  generatedSQL: string;
  nlQuestionEmbedding?: number[];  // 1536-dim OpenAI embedding
  schemaContext: Record<string, unknown>;
  rbacContext: Record<string, unknown>;
  fieldInstructions?: Record<string, unknown>;
  executionTimeMs: number;
  rowCount: number;
  wasSuccessful: boolean;
  errorMessage?: string;
  translationConfidence: number;
  llmConfidence: number;
}

// Store after successful execution
await storeNLQueryContext({
  dataSourceId: "uuid",
  userId: "user-uuid",
  roleName: "analyst",
  nlQuestion: "Show top 10 customers by revenue",
  generatedSQL: "SELECT customer_id, SUM(revenue) ... LIMIT 10",
  nlQuestionEmbedding: [...],  // 1536 values from OpenAI
  schemaContext: { tables: [...], fields: [...] },
  rbacContext: { userId: "...", roles: ["analyst"] },
  executionTimeMs: 245,
  rowCount: 10,
  wasSuccessful: true,
  translationConfidence: 0.95,
  llmConfidence: 0.92
});
```

#### 2. findSimilarQueries()
```typescript
interface SimilarQuery {
  id: string;
  nlQuestion: string;
  generatedSQL: string;
  fieldInstructions?: Record<string, unknown>;
  executionTimeMs: number;
  rowCount: number;
  translationConfidence: number;
  similarity: number;  // 0.0 to 1.0 cosine similarity
}

// Find similar queries using pgvector cosine similarity
const similar = await findSimilarQueries(
  dataSourceId: "uuid",
  roleName: "analyst",
  nlQuestionEmbedding: [...],  // Vector to search for
  limit: 5
);

// Results sorted by similarity (closest first)
// similar[0].similarity might be 0.92 (92% match)
```

#### 3. buildMastraContextPrompt()
```typescript
// Build enhanced prompt with context
const contextPrompt = await buildMastraContextPrompt(
  dataSourceId,
  "analyst",
  "Show top customers",
  schemaJSON,
  embedding
);

// Returns something like:
/*
DATABASE SCHEMA:
  tables: [...]
  
ROLE CONTEXT:
  Role: analyst
  Success Rate: 87%
  Avg Execution Time: 312ms
  Common Patterns: {SELECT: 60%, JOIN: 35%, ...}
  
SIMILAR SUCCESSFUL QUERIES FROM THIS ROLE:
  1. "Show me top 10 customers"
     SQL: SELECT customer_id, SUM(revenue) ... LIMIT 10
     Confidence: 92%
  
  2. "Most valuable customers"
     SQL: SELECT customer_id, revenue ... ORDER BY revenue DESC
     Confidence: 88%
*/
```

#### 4. getRoleQueryStats()
```typescript
const stats = await getRoleQueryStats(dataSourceId, roleName);

// Returns
{
  totalQueries: 347,
  successfulQueries: 301,
  failedQueries: 46,
  successRate: 86.7,
  avgExecutionTime: 312.5,
  avgRowsReturned: 156.2,
  avgConfidence: 0.89,
  commonQueryTypes: {SELECT: 60, JOIN: 35, AGGREGATE: 5},
  commonTables: {customers: 120, orders: 95, products: 50},
  commonJoins: {"customers.id = orders.customer_id": 45}
}
```

## NL Query Pipeline Integration

### Step-by-Step Flow

```typescript
// 1. Get user and roles
const session = await requireAuth();
const primaryRole = session.user.roles[0] || "user";

// 2. Fetch schema and field instructions
const schema = await getSchemaMetadata(dataSource);
const fieldInstructions = await db.selectFrom("schema_field_instructions")...

// 3. Build pgvector context from similar successful queries
const contextPrompt = await buildMastraContextPrompt(
  dataSourceId,
  primaryRole,
  nlQuestion,
  JSON.stringify(schema)
);

// 4. Send to Mastra with enhanced context
const translation = await translateViaMastra(
  nlQuestion,
  schema,
  {
    userId: session.user.id,
    userRoles: session.user.roles,
    contextFromSimilarQueries: contextPrompt  // ← pgvector context here
  }
);

// 5. Validate and execute
const result = await connection.raw(generatedSQL);

// 6. Store for future learning
await storeNLQueryContext({
  nlQuestion,
  generatedSQL,
  roleName: primaryRole,
  executionTimeMs: Date.now() - start,
  rowCount: result.length,
  wasSuccessful: true,
  translationConfidence: 0.95,
  llmConfidence: 0.92
});
```

## Query Characteristics Analysis

The system automatically analyzes and stores SQL characteristics:

```typescript
function analyzeSQLQuery(sql: string): QueryAnalysis {
  return {
    queryType: "JOIN",              // SELECT, JOIN, AGGREGATE, WINDOW, UNION, CTE
    tableCount: 3,                  // Number of tables referenced
    joinCount: 2,                   // Number of JOINs
    hasAggregation: false,          // GROUP BY or aggregate functions?
    hasWindowFunction: false        // OVER() clauses?
  }
}
```

This enables pattern matching:
- Finance role specializes in aggregate queries
- Sales role frequently uses JOINs with customers and orders
- Operations role uses window functions for time series analysis

## Mastra Agent Integration

### Expected Mastra Response Format

Your Mastra server should return:

```json
{
  "sql": "SELECT customer_id, SUM(revenue) FROM orders GROUP BY customer_id...",
  "explanation": "Retrieves top customers by total revenue across all time",
  "confidence": 0.94,
  "canExecute": true,
  "executionReason": "User has analyst role with access to orders and customers tables",
  "embedding": [0.123, -0.456, ...]  // Optional: NL question embedding
}
```

### Mastra Workflow Considerations

Your Mastra workflow should:

1. **Parse Context Prompt** - Understand similar successful queries provided
2. **Respect RBAC Context** - Be aware of user roles and permissions
3. **Use Field Instructions** - Apply business domain hints from schema
4. **Analyze Query Complexity** - Match similar patterns when appropriate
5. **Return Confidence** - Indicate how confident the generation is
6. **Check Executability** - Verify if the query can execute based on user's RBAC

Example workflow:

```javascript
// In your Mastra agent
const agent = new Agent({
  name: "nl-to-sql",
  
  execute: async (input) => {
    const { nlQuestion, context } = input;
    
    // 1. Check similar successful queries
    if (context.contextFromSimilarQueries) {
      console.log("Similar patterns:", context.contextFromSimilarQueries);
      // Use patterns when generating SQL
    }
    
    // 2. Verify RBAC context
    const { userRoles } = context;
    const allowedTables = getTables(userRoles);  // Determine which tables user can access
    
    // 3. Generate SQL using LLM
    const sql = await llm.generate(nlQuestion, {
      schema: context.schema,
      examples: context.contextFromSimilarQueries,
      allowedTables,
      rolePatterns: context.roleStats
    });
    
    // 4. Validate executability
    const canExecute = validatePermissions(sql, userRoles);
    
    return {
      sql,
      confidence: 0.92,
      canExecute,
      embedding: embedText(nlQuestion)  // Optional
    };
  }
});
```

## Embedding Strategy

### Getting NL Question Embeddings

The system expects 1536-dimensional embeddings (OpenAI ada-002 format):

```typescript
// Option 1: Use OpenAI API
import { openai } from "@ai-sdk/openai";

const embedding = await openai.textEmbedding({
  model: "text-embedding-ada-002",
  text: nlQuestion
});

// Returns: [0.123, -0.456, ..., 0.789] // 1536 values

// Option 2: Have Mastra compute it
const response = await mastraAgent.execute({
  nlQuestion,
  includeEmbedding: true
});
const embedding = response.embedding;
```

Then store in pgvector:

```typescript
await storeNLQueryContext({
  nlQuestion: "Show top 10 customers",
  nlQuestionEmbedding: [0.123, -0.456, ...],  // ← Here
  ...
});
```

### Similarity Search

Once stored, retrieve similar queries:

```typescript
const similar = await findSimilarQueries(
  dataSourceId,
  "analyst",
  [0.123, -0.456, ...],  // Query embedding
  5  // Get 5 most similar
);

// Returns queries with similarity scores
// [0.95, 0.88, 0.82, 0.79, 0.76]
```

## Performance Optimization

### Indexes

The system creates indexes for:

1. **Vector Similarity** - IVFFLAT index on embeddings
   ```sql
   CREATE INDEX idx_nl_query_embedding 
   ON nl_query_context USING ivfflat (nl_question_embedding vector_cosine_ops);
   ```

2. **Quick Lookups** - Composite indexes for role/datasource queries
   ```sql
   CREATE INDEX ON nl_query_context(data_source_id, role_name);
   CREATE INDEX ON nl_query_context(user_id, created_at);
   ```

### Query Optimization

```sql
-- Fast: Returns top 5 similar queries for analyst role
SELECT id, nl_question, generated_sql, similarity
FROM (
  SELECT *,
    1 - (nl_question_embedding <=> '[...]'::vector) as similarity
  FROM nl_query_context
  WHERE data_source_id = 'uuid'
    AND role_name = 'analyst'
    AND was_successful = true
    AND nl_question_embedding IS NOT NULL
) AS ranked
ORDER BY similarity DESC
LIMIT 5;
```

## Continuous Learning

### Feedback Loop

1. **User executes query** → Stored in nl_query_context
2. **Query succeeds** → Available for role context
3. **User provides feedback** → Stored in nl_query_feedback
4. **System refines patterns** → Better context for future queries

### Success Metrics Tracking

Role statistics are automatically updated:

```
┌─ Before Query ──────────────┐
│ analyst success_rate: 85%   │
│ total_queries: 100          │
│ avg_confidence: 0.87        │
└─────────────────────────────┘
           ↓ (execute query)
┌─ After Query ───────────────┐
│ analyst success_rate: 85.2% │
│ total_queries: 101          │
│ avg_confidence: 0.871       │
└─────────────────────────────┘
```

## Example: Role-Based Learning

### Scenario 1: Finance Team

Finance team members frequently ask:
- "Total revenue for Q4 2024"
- "Customer revenue trends"
- "Sales by product category"

pgvector learns:
```json
{
  "role": "finance",
  "common_patterns": {
    "query_type": "AGGREGATE",
    "tables": ["orders", "products"],
    "aggregations": ["SUM(revenue)", "COUNT(orders)"],
    "grouping": ["product_category", "customer_segment"]
  },
  "success_rate": 0.91,
  "avg_execution_time": 285
}
```

When finance user asks: "Revenue per category"
System finds 3 similar queries with 89-92% match, learns aggregation patterns.

### Scenario 2: Operations Team

Operations team frequently asks:
- "Processing time for orders"
- "Daily throughput trends"
- "Bottleneck analysis"

pgvector learns:
```json
{
  "role": "operations",
  "common_patterns": {
    "query_type": "WINDOW",
    "tables": ["orders", "order_items", "timestamps"],
    "window_functions": ["ROW_NUMBER()", "LAG()", "LEAD()"],
    "time_windows": ["PARTITION BY DATE", "ORDER BY created_at"]
  },
  "success_rate": 0.88,
  "avg_execution_time": 450
}
```

When operations user asks: "Time between orders per customer"
System finds similar window function patterns, improves accuracy.

## Troubleshooting

### pgvector Not Found

Error: `type "vector" does not exist`

```bash
# Enable pgvector extension
psql -c "CREATE EXTENSION IF NOT EXISTS vector"
```

### Slow Similarity Searches

If queries > 100k rows, create IVFFLAT index with more lists:

```sql
CREATE INDEX idx_nl_query_embedding_ivfflat
ON nl_query_context USING ivfflat (nl_question_embedding)
WITH (lists = 200);  -- Increase for larger datasets
```

### Memory Issues

For very large query contexts, limit similar query retrieval:

```typescript
// Retrieve only recent successful queries (last 30 days)
const similar = await findSimilarQueries(
  dataSourceId,
  role,
  embedding,
  3  // Reduce from 5 to 3
);
```

## Monitoring

### Track System Learning

```sql
-- See role success rates over time
SELECT 
  role_name,
  DATE(updated_at) as day,
  success_rate,
  total_queries
FROM nl_query_role_stats
ORDER BY updated_at DESC;
```

### Identify Common Patterns

```sql
-- Most common query patterns by role
SELECT 
  role_name,
  query_type,
  COUNT(*) as count,
  AVG(translation_confidence) as avg_confidence,
  AVG(execution_time_ms) as avg_time
FROM nl_query_context
WHERE was_successful = true
GROUP BY role_name, query_type
ORDER BY count DESC;
```

### Find Problematic Patterns

```sql
-- Queries with lowest confidence scores
SELECT 
  role_name,
  nl_question,
  translation_confidence,
  llm_confidence,
  was_successful
FROM nl_query_context
WHERE translation_confidence < 0.75
ORDER BY translation_confidence ASC
LIMIT 20;
```

## Next Steps

1. **Enable pgvector** - `CREATE EXTENSION vector`
2. **Run migrations** - `bun run db:migrate`
3. **Update Mastra** - Support embedding responses
4. **Monitor learning** - Track role success rates
5. **Refine prompts** - Use feedback table insights
6. **Expand patterns** - Add more roles and domains

This system transforms NL queries into an adaptive, role-aware system that learns from every successful execution.
