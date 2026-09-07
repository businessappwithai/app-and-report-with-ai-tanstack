# @appwithai/ai

AI-powered ERD design with Mastra.ai orchestration.

## Features

- Natural language to ERD conversion
- 5 specialized AI agents (Domain, Entity, Relationship, Validation, Mermaid)
- Human-in-the-loop workflows
- Standalone CLI tool

## Quick Start

```bash
# CLI usage
appwithai-convert "Blog with users and posts" -o blog.mermaid

# Programmatic usage
import { convertToMermaid } from '@appwithai/ai/converter';
const mermaid = await convertToMermaid("Your description");
```

## API Reference

See full documentation in docs/ai-design-guide.md
