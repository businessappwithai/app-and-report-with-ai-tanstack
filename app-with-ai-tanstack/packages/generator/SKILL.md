---
name: appwithai-generator
description: Code generation engine with Mermaid parsing and Handlebars template loading for APPWITHAI
---

# @appwithai/generator Skill

This skill provides guidance for working with the generator package of APPWITHAI, which handles parsing Mermaid ERD syntax and generating application code using Handlebars templates.

## Package Overview

The generator package is responsible for:

- **Mermaid Parsing**: Converting Mermaid ERD syntax into structured Entity objects
- **Template Loading**: Loading and compiling Handlebars templates with custom helpers
- **Code Generation**: Producing application code for multiple stacks (TanStack Start, NestJS, OData, OpenUI5)
- **CLI Tool**: Command-line interface for code generation

## Directory Structure

```
packages/generator/
├── src/
│   ├── cli/
│   │   └── generate.ts          # CLI entry point
│   ├── generators/
│   │   ├── base.generator.ts    # Abstract base generator
│   │   ├── tanstack.generator.ts # TanStack Start + NestJS generator
│   │   ├── odata.generator.ts   # OData v4 generator
│   │   └── ui5.generator.ts     # OpenUI5 + FCL generator
│   ├── parsers/
│   │   └── mermaid.parser.ts    # Mermaid ERD parser
│   ├── templates/
│   │   └── loader.ts            # Handlebars template loader
│   └── index.ts
├── templates/                    # Handlebars templates
│   ├── tanstackjs-nestjs/
│   ├── odata/
│   └── ui5/
└── package.json
```

## Key Concepts

### Mermaid Parser

Parses Mermaid ERD syntax into structured data:

```typescript
import { MermaidParser } from '@appwithai/generator';

const parser = new MermaidParser();
const result = parser.parse(`
erDiagram
    User ||--o{ Post : creates
    
    User {
        string id PK
        string email UK
        string name
    }
    
    Post {
        string id PK
        string title
        string content
        string authorId FK
    }
`);

console.log(result.entities);      // Array of Entity objects
console.log(result.relationships); // Array of Relationship objects
```

### Template Loader

Loads Handlebars templates with pre-registered helpers:

```typescript
import { TemplateLoader } from '@appwithai/generator';

const loader = new TemplateLoader('./templates/tanstackjs-nestjs');
const template = await loader.load('page.tsx.hbs');

const output = template({
  entity: userEntity,
  entities: allEntities
});
```

### Built-in Handlebars Helpers

The template loader registers these helpers automatically:

- `pascalCase` - Convert to PascalCase
- `camelCase` - Convert to camelCase
- `snakeCase` - Convert to snake_case
- `kebabCase` - Convert to kebab-case
- `plural` - Pluralize a word
- `singular` - Singularize a word
- `eq` - Equality check
- `ne` - Not equal check
- `and` - Logical AND
- `or` - Logical OR

### Base Generator Pattern

All generators extend the BaseGenerator class:

```typescript
import { BaseGenerator } from '@appwithai/generator';
import type { Entity, Relationship } from '@appwithai/core/types';

class CustomGenerator extends BaseGenerator {
  async generate(entities: Entity[], relationships: Relationship[]): Promise<void> {
    // Use this.loader for templates
    // Use this.outputDir for output location
  }
}
```

## CLI Usage

```bash
# Generate TanStack Start application
bun --filter @appwithai/generator generate -- --stack tanstack --input schema.erd --output ./generated

# Generate OData service
bun --filter @appwithai/generator generate -- --stack odata --input schema.erd --output ./generated

# Generate OpenUI5 application
bun --filter @appwithai/generator generate -- --stack ui5 --input schema.erd --output ./generated
```

## Building the Package

```bash
# Build only generator
bun run build:generator

# Requires core to be built first
bun run build:core && bun run build:generator
```

## Dependencies

- **@appwithai/core**: workspace:* - Core types and utilities
- **handlebars**: ^4.7.8 - Template engine
- **commander**: ^11.1.0 - CLI framework
- **kysely**: ^0.27.0 - Type-safe SQL query builder (for database operations)
- **prettier**: ^3.1.1 - Code formatting

## Common Tasks

### Adding a New Generator Stack

1. Create `src/generators/mystack.generator.ts`
2. Extend `BaseGenerator`
3. Create templates in `templates/mystack/`
4. Register in CLI `src/cli/generate.ts`

### Adding a New Handlebars Helper

1. Open `src/templates/loader.ts`
2. Add to `registerHelpers()` method:
   ```typescript
   Handlebars.registerHelper('myHelper', (value) => {
     return transformed(value);
   });
   ```

### Creating Templates

Templates use Handlebars syntax:

```handlebars
// templates/tanstackjs-nestjs/page.tsx.hbs
import { {{pascalCase entity.name}}List } from '@/components';

export default function {{pascalCase entity.name}}Page() {
  return (
    <div>
      <h1>{{plural entity.name}}</h1>
      <{{pascalCase entity.name}}List />
    </div>
  );
}
```

## Template Variables

Templates receive these context variables:

- `entity` - Current entity being generated
- `entities` - All entities in the schema
- `relationships` - All relationships
- `config` - Generator configuration

## Exports

- `@appwithai/generator` - Main entry point
- CLI: `appwithai-generate` - CLI binary

## Testing

```bash
cd packages/generator
bun test
```
