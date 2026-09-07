# Mastra.ai Setup Guide for NL Query

This guide explains how to set up and use Mastra.ai with the Enterprise Reporting System's Natural Language Query feature.

## Overview

The NL Query feature now supports two translation engines:

1. **Mastra.ai Agent** (Primary) - Orchestrates NL to SQL translation through a Mastra workflow
2. **Ollama** (Fallback) - Direct SQL generation using sqlcoder model

The system automatically tries Mastra first, then falls back to Ollama if needed.

## Prerequisites

- Node.js/Bun runtime
- Either Mastra.ai server OR Ollama installed
- PostgreSQL or SQLite database for testing

## Configuration

### Option 1: Mastra.ai Server (Recommended)

#### 1. Start Mastra.ai Server

If you have a Mastra.ai server running, ensure it's accessible on port 4111:

```bash
# Example: If you have a separate Mastra project
cd /path/to/mastra/project
npm run dev  # Should start on http://localhost:4111
```

#### 2. Configure Environment Variable

Set the Mastra URL (optional if using default):

```bash
# In .env or .env.local
MASTRA_URL=http://localhost:4111
```

#### 3. Mastra Agent Endpoints

Your Mastra server should expose these endpoints:

**Health Check:**
```
GET /health
Response: 200 OK
```

**NL to SQL Translation:**
```
POST /api/nl-to-sql
Content-Type: application/json

Request Body:
{
  "nlQuestion": "How many customers are in the database?",
  "schema": {
    "tables": [...],
    "views": [...]
  },
  "context": {...}
}

Response:
{
  "sql": "SELECT COUNT(*) FROM customers",
  "explanation": "Counts all customers in the database",
  "confidence": 0.95,
  "warnings": []
}
```

**SQL Validation (Optional):**
```
POST /api/validate-sql
Content-Type: application/json

Request Body:
{
  "sql": "SELECT * FROM users"
}

Response:
{
  "isValid": true,
  "errors": []
}
```

### Option 2: Ollama Fallback

If Mastra is not available, the system automatically falls back to Ollama:

```bash
# Install Ollama from https://ollama.ai

# Pull the sqlcoder model
ollama pull sqlcoder:7b

# Start Ollama server (runs on http://localhost:11434 by default)
ollama serve
```

Configure Ollama settings (optional):

```bash
# In .env or .env.local
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=sqlcoder
```

## NL Query Workflow

### User Flow

1. **User navigates to NL Query page** (`/nl-query`)
2. **Selects a data source** from dropdown
3. **Enters natural language question** (e.g., "Show top 10 customers")
4. **System generates SQL:**
   - Fetches schema metadata
   - Sends question to Mastra agent (primary)
   - Falls back to Ollama if needed
   - Validates generated SQL
   - Checks RBAC permissions
5. **Results displayed** in table or chart format

### Backend Pipeline

```
User Question
    ↓
Fetch Schema Metadata + RBAC Context
    ↓
Try Mastra.ai Agent → /api/nl-to-sql
    ↓ (if Mastra fails)
Try Ollama → /api/generate
    ↓
Validate SQL (ANTLR, allowlist)
    ↓
Check RBAC Permissions
    ↓
Execute Query
    ↓
Log to Audit Trail
    ↓
Return Results
```

## Creating a Mastra Agent

### Example Mastra Workflow

```typescript
// src/agents/nl-query-agent.ts
import Mastra from "@mastra/core";

const nlQueryAgent = new Mastra.Agent({
  name: "nl-query-agent",
  description: "Translates natural language to SQL",
  
  tools: [
    {
      name: "generateSQL",
      description: "Generates SQL from natural language",
      execute: async ({ nlQuestion, schema }) => {
        // Call your LLM or SQL generation logic
        return { sql: "SELECT ...", explanation: "..." };
      }
    }
  ],
  
  workflows: [
    {
      name: "translateNLToSQL",
      steps: [
        { tool: "generateSQL", name: "generation" },
        { tool: "validateSQL", name: "validation" },
      ]
    }
  ]
});

// Expose REST API endpoints
export const routes = {
  "POST /api/nl-to-sql": async (req) => {
    const { nlQuestion, schema, context } = await req.json();
    const result = await nlQueryAgent.workflows.translateNLToSQL.execute({
      nlQuestion,
      schema,
      context
    });
    return new Response(JSON.stringify(result));
  }
};
```

## Troubleshooting

### Issue: "Natural language queries require either Mastra.ai or Ollama"

**Solution:**
1. Check if Mastra is running: `curl http://localhost:4111/health`
2. Check if Ollama is running: `curl http://localhost:11434/api/tags`
3. If both missing, start one of them:
   - Mastra: `npm run dev` in your Mastra project
   - Ollama: `ollama serve`

### Issue: "Mastra not responding"

**Solution:**
1. Verify Mastra URL: `echo $MASTRA_URL`
2. Check network connectivity: `curl -v http://localhost:4111/health`
3. Check Mastra server logs for errors
4. System will automatically fall back to Ollama

### Issue: "Generated SQL is invalid"

**Solution:**
1. Ensure schema metadata is correct
2. Check SQL validation rules in ANTLR validator
3. Review Mastra/Ollama prompt engineering
4. Add more detailed schema instructions via admin panel

### Issue: "RBAC permission denied"

**Solution:**
1. Check user roles: Admin panel → Users
2. Verify data source permissions
3. Check query access validator logs
4. Grant necessary permissions to user role

## Monitoring

### Check Translation Source

View server logs to see which engine was used:

```bash
# If using Mastra
[NLQuery] Using Mastra.ai agent for translation

# If Mastra failed and fell back
[NLQuery] Mastra not available, falling back to Ollama
[NLQuery] Using Mastra.ai + Ollama for translation
```

### Audit Trail

All NL queries are logged in the audit trail:
- Admin → Audit Log → Search for "nl_query_*" actions
- View query, translation source, result status

### Performance Metrics

- Translation time: typically 2-5 seconds
- Validation time: <500ms
- Execution time: depends on query complexity

## Best Practices

### 1. Schema Instructions

Add detailed business context via Admin → Schema Instructions:

```
Table: customers
Description: Customer master data
Business Domain: Sales

Field: customer_id
Description: Unique customer identifier
Examples: CUST-001, CUST-002
LLM Instructions: Use this as the primary join key
```

### 2. Data Source Permissions

Restrict NL queries to appropriate schemas:
- Financial data: Finance team only
- HR data: HR team only
- Customer data: Sales team with supervision

### 3. Query Approval Workflow

For sensitive queries, enable approval requirement:

```typescript
// In NL Query execution
if (confidence < 0.9) {
  // Require approval
  return {
    requiresApproval: true,
    sql: generatedSQL,
    confidence: 0.85
  };
}
```

## API Reference

### Mastra Health Endpoint

```bash
curl http://localhost:4111/health
# Response: 200 OK
```

### NL Query Execution

```bash
curl -X POST http://localhost:4050/api/nl-query/execute \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=..." \
  -d '{
    "nlQuestion": "Show me top 10 customers by revenue",
    "dataSourceId": "uuid-here",
    "timeout": 30000
  }'
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "sql": "SELECT customer_id, SUM(revenue) as total_revenue FROM orders GROUP BY customer_id ORDER BY total_revenue DESC LIMIT 10",
    "englishMeaning": "Top 10 customers by total revenue",
    "confidence": 0.92,
    "rows": [...],
    "rowCount": 10,
    "executionTime": 1250
  }
}
```

## Integration Tests

Run the NL Query tests:

```bash
# Test with Mastra
bun run test:e2e -- e2e/test-nl-query-mastra.spec.ts

# Test complete flow
bun run test:e2e -- e2e/test-nl-query-complete.spec.ts

# Debug any issues
bun run test:e2e -- e2e/test-nl-query-debug.spec.ts
```

## Next Steps

1. **Set up your Mastra.ai server** with the required endpoints
2. **Configure `MASTRA_URL`** environment variable
3. **Test the NL Query feature** via the UI
4. **Add schema instructions** for better accuracy
5. **Monitor audit logs** for translation sources and performance
6. **Refine prompts** based on real usage patterns

## Support

For issues or questions:
- Check server logs: `docker logs app`
- Review Mastra documentation: https://mastra.ai/docs
- Check Ollama setup: https://ollama.ai/
- Enable verbose logging: `DEBUG=*:nlquery`
