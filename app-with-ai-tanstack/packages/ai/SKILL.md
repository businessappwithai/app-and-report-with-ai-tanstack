---
name: appwithai-ai
description: Mastra.ai orchestration for AI-powered ERD design with human-in-the-loop workflows
---

# @appwithai/ai Skill

This skill provides guidance for working with the AI package of APPWITHAI, which integrates Mastra.ai for AI-powered entity-relationship diagram design with human-in-the-loop (HITL) approval workflows.

## Package Overview

The AI package provides:

- **AI Agents**: Specialized agents for domain analysis, entity refinement, relationship detection, and Mermaid generation
- **HITL Workflows**: Human-in-the-loop workflows using Mastra.ai suspend/resume
- **Converter**: Standalone AI-to-Mermaid conversion utilities
- **CLI Tool**: Command-line interface for AI conversion

## Directory Structure

```
packages/ai/
├── src/
│   ├── agents/
│   │   ├── domain-agent.ts       # Analyzes domain descriptions
│   │   ├── entity-agent.ts       # Refines entity structure
│   │   ├── relationship-agent.ts # Determines relationship cardinality
│   │   ├── mermaid-agent.ts      # Generates Mermaid ERD syntax
│   │   └── index.ts
│   ├── workflows/
│   │   ├── erd-design-workflow.ts # HITL ERD design workflow
│   │   └── index.ts
│   ├── converter/
│   │   └── index.ts              # Standalone conversion utilities
│   ├── cli/
│   │   └── convert.ts            # CLI entry point
│   ├── types/
│   │   └── index.ts              # Zod schemas and types
│   ├── mastra.ts                 # Mastra instance configuration
│   └── index.ts
└── package.json
```

## Key Concepts

### AI Agents

Each agent is specialized for a specific task in the ERD design process:

#### Domain Agent
Analyzes natural language descriptions and extracts entities/relationships:

```typescript
import { analyzeDomain } from '@appwithai/ai';

const analysis = await analyzeDomain(
  "E-commerce platform where users browse products, add to cart, and place orders"
);

console.log(analysis.entities);      // User, Product, Cart, Order
console.log(analysis.relationships); // User -> Cart, Cart -> Product, etc.
```

#### Entity Agent
Refines entity structure with proper naming and validation:

```typescript
import { refineEntity } from '@appwithai/ai';

const refined = await refineEntity({
  name: 'user',
  attributes: [{ name: 'email', type: 'text' }]
});
// Returns: User with proper PascalCase, id, timestamps, email validation
```

#### Mermaid Agent
Generates Mermaid ERD syntax (with programmatic fallback):

```typescript
import { generateMermaidProgrammatic } from '@appwithai/ai';

const result = generateMermaidProgrammatic(entities, relationships);
console.log(result.mermaidSyntax);
// erDiagram
//     User ||--o{ Post : creates
//     ...
```

### Mastra.ai Integration

The package uses Mastra.ai for agent orchestration:

```typescript
import { mastra } from '@appwithai/ai';

// Get the Mastra instance
const agent = mastra.getAgent('domainAgent');

// Get workflows
const workflow = mastra.getWorkflow('erdDesignWorkflow');
```

### HITL Workflows

Workflows support suspension for human approval:

```typescript
import { erdDesignWorkflow } from '@appwithai/ai';

// Start workflow
const run = await erdDesignWorkflow.execute({
  description: "Blog platform with users and posts"
});

// Workflow suspends at each approval point
// Frontend shows approval UI
// Resume with user decision:
await run.resume({
  step: 'entity-approval',
  resumeData: { approved: true, modifications: { ... } }
});
```

### AI Converter

For quick conversions without the full workflow:

```typescript
import { AIToMermaidConverter, convertToMermaid } from '@appwithai/ai';

// Quick conversion
const mermaid = await convertToMermaid("Blog with users and posts");

// Full converter with options
const converter = new AIToMermaidConverter();
const result = await converter.convert({
  description: "E-commerce platform",
  options: {
    skipApprovals: false,
    autoGenerateMermaid: true
  }
});
```

## CLI Usage

```bash
# Basic conversion
appwithai-convert "Blog with users and posts" -o blog.mermaid

# From file
appwithai-convert -i description.txt -o output.mermaid

# Fast mode (programmatic Mermaid, no AI)
appwithai-convert "E-commerce" --fast -o ecommerce.mermaid

# Analysis only (JSON output)
appwithai-convert "CRM system" --analyze-only --json
```

## Environment Variables

Create `.env` file with:

```bash
ANTHROPIC_API_KEY=sk-ant-xxx           # Required for AI agents
MASTRA_DATABASE_URL=file:./mastra.db   # Mastra state storage
MASTRA_LOG_LEVEL=info                  # Logging level
MASTRA_PORT=4111                       # Mastra server port (if running)
```

## Building the Package

```bash
# Build AI package (requires core first)
bun run build:core && bun run build:ai

# Run Mastra server
bun run dev:mastra
```

## Dependencies

- **@appwithai/core**: workspace:* - Core types
- **@mastra/core**: ^1.0.0-beta.19 - Mastra AI orchestration
- **@mastra/loggers**: ^1.0.0-beta.3 - Mastra logging
- **@mastra/libsql**: ^1.0.0-beta.8 - Mastra LibSQL storage
- **@mastra/memory**: ^1.0.0-beta.5 - Mastra memory
- **@ag-ui/mastra**: latest - AG-UI Mastra integration
- **zod**: ^3.22.4 - Schema validation
- **commander**: ^11.1.0 - CLI framework

## Common Tasks

### Adding a New Agent

1. Create `src/agents/my-agent.ts`:
   ```typescript
   import { Agent } from '@mastra/core/agent';
   
   export const myAgent = new Agent({
     id: 'my-agent',
     name: 'My Agent',
     instructions: `Your instructions here...`,
     model: 'anthropic/claude-sonnet-4-20250514'
   });
   ```

2. Export from `src/agents/index.ts`
3. Register in `src/mastra.ts`

### Adding a Workflow Step

1. Edit `src/workflows/erd-design-workflow.ts`
2. Create step with `createStep()`
3. Add to workflow chain with `.then()`

### Modifying Agent Prompts

Agent prompts are in the `instructions` field of each agent. Update them in:
- `src/agents/domain-agent.ts`
- `src/agents/entity-agent.ts`
- `src/agents/relationship-agent.ts`
- `src/agents/mermaid-agent.ts`

## Type Definitions

Key types in `src/types/index.ts`:

```typescript
interface EntityCandidate {
  name: string;
  description: string;
  suggestedAttributes: Array<{
    name: string;
    type: string;
    required: boolean;
    unique?: boolean;
  }>;
  confidence: number;  // 0-1
  reasoning: string;
}

interface RelationshipCandidate {
  name: string;
  source: string;
  target: string;
  cardinality: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
  confidence: number;
  reasoning: string;
}

interface DomainAnalysis {
  entities: EntityCandidate[];
  relationships: RelationshipCandidate[];
  summary: string;
}
```

## Exports

- `@appwithai/ai` - Main entry point
- CLI: `appwithai-convert` - CLI binary

## Testing

```bash
cd packages/ai
bun test
```
