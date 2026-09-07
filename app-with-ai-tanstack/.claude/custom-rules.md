# Project-Specific Rules

## MANDATORY: Use Bun.js Runtime Only

**CRITICAL RULE**: This project uses **Bun.js** as the exclusive JavaScript/TypeScript runtime.

### ⛔ FORBIDDEN:
- **NEVER** use `node` command
- **NEVER** use `npx` command
- **NEVER** use Node.js-specific scripts or shebangs (`#!/usr/bin/env node`)
- **NEVER** reference Node.js in documentation or comments
- **NEVER** create `.js` files without explicit Bun.js context

### ✅ REQUIRED:
- **ALWAYS** use `bun` command for running scripts
- **ALWAYS** use `bunx` instead of `npx` for package execution
- **ALWAYS** use `#!/usr/bin/env bun` shebang for executable scripts
- **ALWAYS** create `.ts` (TypeScript) files when possible
- **ALWAYS** reference Bun.js in documentation and comments

### Command Migrations:

| Instead of... | Use... |
|--------------|--------|
| `node script.js` | `bun script.ts` |
| `npx tsx script.ts` | `bunx tsx script.ts` OR `bun run tsx script.ts` |
| `npx package-name` | `bunx package-name` |
| `#!/usr/bin/env node` | `#!/usr/bin/env bun` |

### Examples:

**❌ WRONG:**
```bash
npx tsx run-migrations.ts
node script.js
#!/usr/bin/env node
```

**✅ CORRECT:**
```bash
bunx tsx run-migrations.ts
bun script.ts
#!/usr/bin/env bun
```

### Testing Commands:

**All test scripts must use:**
```bash
bun run test
bun run tsx test-script.ts
bunx playwright test
```

### Package Scripts:

**package.json scripts should prefer:**
```json
{
  "scripts": {
    "test": "bun test",
    "dev": "bun --filter @package/name dev",
    "start": "bun run src/index.ts"
  }
}
```

### Verification:

When creating or modifying any execution script, verify:
1. [ ] Shebang is `#!/usr/bin/env bun` (not node)
2. [ ] Runtime references say "Bun.js" (not Node.js)
3. [ ] Commands use `bun` or `bunx` (not node or npx)
4. [ ] File extensions are `.ts` when possible
5. [ ] No Node.js-specific APIs are used

---

## Additional Project Context

This is an ERD-to-Code generator project that creates full-stack applications from entity-relationship diagrams. The generated apps use:
- **Backend**: NestJS with Fastify + SQLite/Knex
- **Frontend**: Next.js 14 with App Router + React Query
- **Runtime**: Bun.js for all TypeScript execution
- **Database**: SQLite (better-sqlite3) for development, PostgreSQL for production

Always ensure generated code and templates follow the Bun.js-only rule.
