# Two-Phase Generation Migration Guide

## Summary of Changes

This guide explains the migration from **single-phase template generation** to the new **two-phase CLI + template generation** approach.

## What Changed

### Architecture

**Before (Single-Phase):**
```
ERD Input
    ↓
Template Engine (Handlebars)
    ↓
Generated Application
```

**After (Two-Phase):**
```
ERD Input
    ↓
[Phase 1] Official CLI Scaffolding (nest new / bun create tanstack-start)
    ↓
Base Project with Framework Best Practices
    ↓
[Phase 2] Template Overlay (Custom Code Generation)
    ↓
Complete Generated Application
```

### File Structure Changes

#### Backend (`packages/generator/src/generators/tanstackjs-nestjs/nestjs-backend.generator.ts`)

**Key Method Changes:**
- ❌ Removed: `createDirectoryStructure()` - Manual directory creation
- ✅ Added: `scaffoldNestJsProject()` - Runs NestJS CLI
- ✅ Added: `createAdditionalDirectories()` - Creates custom structure on top
- 🔄 Renamed: `generateConfigFiles()` → `updateConfigFiles()` - Now enhances CLI config

**Generation Flow:**
```typescript
// OLD: Direct template application
async generate() {
  await this.createDirectoryStructure(outputDir);
  await this.prepareContext();
  await this.generateCoreFiles();
  // ... more generation steps
}

// NEW: CLI + Template overlay
async generate() {
  await this.scaffoldNestJsProject(outputDir);      // Phase 1
  const context = this.prepareContext();
  await this.createAdditionalDirectories(outputDir);
  await this.generateCoreFiles(outputDir, context); // Phase 2
  // ... more generation steps
}
```

#### Frontend (`packages/generator/src/generators/tanstackjs-nestjs/nextjs-frontend.generator.ts`)

**Key Method Changes:**
- ❌ Removed: `createDirectoryStructure()` - Manual directory creation
- ✅ Added: `scaffoldTanStackProject()` - Runs TanStack Start CLI
- ✅ Added: `createAdditionalDirectories()` - Creates custom structure on top
- 🔄 Renamed: `generateConfigFiles()` → `updateConfigFiles()` - Now enhances CLI config

**Note:** Environment variable names updated:
- `NEXT_PUBLIC_API_URL` → `VITE_API_URL` (TanStack Start uses Vite)
- Added `VITE_MASTRA_URL` for AI service integration

### New Utilities

#### CLI Executor (`packages/generator/src/utils/cli-executor.ts`)

A new utility class for safe CLI command execution:

```typescript
// Synchronous execution
CliExecutor.executeSync('command', ['arg1', 'arg2'], options);

// Asynchronous execution (recommended)
await CliExecutor.executeAsync('command', ['arg1', 'arg2'], options);

// Check availability
if (CliExecutor.isCommandAvailable('nest')) { ... }

// Get version
const version = CliExecutor.getCommandVersion('nest');

// Directory operations
await CliExecutor.removeDirectory(path);
await CliExecutor.copyDirectory(src, dest);
```

## Dependencies

### New Requirements

The new two-phase generation requires CLI tools to be available:

**NestJS Backend:**
```bash
# Option 1: Global installation
npm install -g @nestjs/cli

# Option 2: Use through bunx (no installation needed)
bunx nest new project-name
```

**TanStack Start Frontend:**
```bash
# Available through bun (no separate installation needed)
bun create tanstack-start@latest project-name
```

### No New npm Dependencies

The generator itself doesn't require new npm dependencies:
- Uses Node.js built-in `child_process` module
- No need to update `packages/generator/package.json` (apart from normal updates)

## Migration Steps

### For End Users

1. **Update generator package** - Pull latest code changes
2. **Install CLI tools (optional):**
   ```bash
   npm install -g @nestjs/cli
   # TanStack Start is available via bun automatically
   ```
3. **Regenerate projects** - Use the generator as normal
4. **Compare outputs** (optional):
   - Run old generator on a copy of project
   - Run new generator and compare structures
   - Both should produce functional applications

### For Framework Maintainers

If you maintain this generator:

1. **Update templates** - Ensure they work with both phases:
   ```handlebars
   {{!-- These templates now overlay on CLI scaffold --}}
   {{!-- Make sure they don't conflict with framework defaults --}}
   ```

2. **Handle graceful degradation** - Phase 1 can fail, Phase 2 should still work:
   ```typescript
   try {
     await this.scaffoldNestJsProject(outputDir);
   } catch (error) {
     console.warn('Phase 1 failed, continuing with Phase 2');
     // Phase 2 creates missing directories as fallback
   }
   ```

3. **Test both phases**:
   - ✅ Test Phase 1 CLI scaffolding independently
   - ✅ Test Phase 2 template overlay independently
   - ✅ Test both phases together
   - ✅ Test Phase 1 failure handling

## Configuration Changes

### Environment Variables

**Frontend (.env.local)**

```diff
- NEXT_PUBLIC_API_URL=http://localhost:3000
+ VITE_API_URL=http://localhost:3000
+ VITE_MASTRA_URL=http://localhost:4111
  PORT=3001
```

### package.json Updates

The generator now **enhances** the CLI scaffold's package.json instead of replacing it:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@nestjs/common": "^10.0.0",          // From Phase 1 (NestJS CLI)
    "@nestjs/core": "^10.0.0",            // From Phase 1
    "@nestjs/fastify": "^10.0.0",         // Added by Phase 2
    "kysely": "^0.27.0",                   // Added by Phase 2
    "better-auth": "^0.21.0"              // Added by Phase 2
  },
  "scripts": {
    "start": "node dist/main",             // From Phase 1
    "start:dev": "nest start --watch",     // From Phase 1
    "build": "nest build",                 // From Phase 1
    "migrate": "bun run migrate",          // Added by Phase 2
    "seed": "bun run seed"                 // Added by Phase 2
  }
}
```

## Troubleshooting Migration

### Issue: CLI commands not found

**Error:**
```
❌ Command failed: nest new my-project
Error: Command not found
```

**Solution:**
```bash
# Install globally
npm install -g @nestjs/cli

# Or let bunx handle it automatically
bunx nest new my-project
```

### Issue: Different generated output

Generated projects might look slightly different due to updated framework versions. This is expected and beneficial:

**Why:**
- Phase 1 uses latest stable CLI versions
- Your old generator might have used older template versions
- New versions have better practices and more features

**Validation:**
1. Check `package.json` dependencies - should have latest versions
2. Verify project builds: `bun install && bun run build`
3. Run tests: `bun run test`
4. Test the app locally

### Issue: Existing generated projects

**Q: Do I need to regenerate all existing projects?**

A: No, existing projects will continue to work. However, you can optionally regenerate to:
- Get latest framework versions
- Benefit from CLI-provided configurations
- Have cleaner default project structure

**Migration Path:**
```bash
# Backup existing project
cp -r my-project my-project.backup

# Create new project with two-phase generation
bun run generate:tanstack  # or your generation command

# Compare structures
diff -r my-project my-project.backup

# If new version is better, use it; otherwise keep backup
```

## Rollback Plan

If you prefer the old single-phase generation:

### Option 1: Use Previous Generator Version
```bash
git checkout <old-commit-hash> -- packages/generator/src/generators/
```

### Option 2: Manual Removal of Phase 1

Edit generator files to skip Phase 1 scaffolding:

```typescript
// In nestjs-backend.generator.ts
async generate() {
  // Comment out Phase 1
  // await this.scaffoldNestJsProject(outputDir);

  // Create directories manually (old approach)
  await this.createAdditionalDirectories(outputDir);
  // ... rest of generation
}
```

## Performance Impact

### Generation Time

```
Old (Single-Phase):
  Template rendering: ~15-30 seconds
  Total: ~15-30 seconds

New (Two-Phase):
  Phase 1 (CLI): ~2-5 minutes (first time, includes npm/bun install)
                 ~30 seconds (cached dependencies)
  Phase 2 (Templates): ~10-30 seconds
  Total: ~2-5 minutes (first time, plus 10-30s for Phase 2)
         ~40 seconds (subsequent times with cached deps)
```

### First Generation Optimization

To speed up first generation:

```bash
# Pre-install dependencies
npm install -g @nestjs/cli

# Pre-fetch TanStack Start template
bun create tanstack-start dummy --yes
rm -rf dummy

# Now generate will use cached versions
bun run generate:tanstack
```

## Testing the Migration

### Unit Tests

Run existing generator tests:
```bash
bun run test
```

Tests should cover:
- Phase 1 CLI execution
- Phase 2 template rendering
- Both phases together
- Error handling and fallbacks

### Integration Tests

Test with real ERD:

```bash
# Generate a project
bun run generate:tanstack

# Verify the output
cd generated-projects/my-project
bun install
bun run build
bun run dev
```

### E2E Tests

Test the complete flow:

```bash
# 1. Create ERD
# 2. Generate project (Phase 1 + Phase 2)
# 3. Install dependencies
# 4. Build project
# 5. Start dev server
# 6. Run Playwright E2E tests
```

## Best Practices After Migration

### 1. Version Control

Include generated projects in git to track framework versions:

```bash
git add generated-projects/
git commit -m "Generated project with two-phase generation"
```

### 2. Regular Updates

Periodically regenerate to get framework updates:

```bash
# Monthly or quarterly
bun run generate:tanstack
```

### 3. Customization

Don't modify Phase 1 output (CLI scaffold), customize Phase 2 templates instead:

```
Generated Project:
├── [Phase 1 - Don't modify]
│   ├── src/main.ts
│   ├── src/app.module.ts
│   └── ... (from nest new)
├── [Phase 2 - Safe to customize]
│   ├── src/modules/
│   ├── migrations/
│   └── ... (from templates)
└── [Merge Points]
    ├── package.json       (merge)
    ├── tsconfig.json      (can override)
    └── ... configs
```

### 4. Framework Updates

When NestJS or TanStack Start releases new versions:

1. CLI automatically uses latest (Phase 1)
2. Update templates as needed (Phase 2)
3. Regenerate projects to test compatibility

## Support

### Documentation

- [Two-Phase Generation Architecture](./TWO_PHASE_GENERATION.md)
- [CLI Executor Usage](./src/utils/README.md)
- [Generator CLI Reference](./README.md)

### Reporting Issues

If you encounter issues:

1. **Check CLI availability:**
   ```bash
   nest --version
   bun --version
   ```

2. **Reproduce with clean generation:**
   ```bash
   rm -rf test-project
   bun run generate:tanstack
   ```

3. **Check error logs** from Phase 1 and Phase 2

4. **Try manual scaffolding:**
   ```bash
   nest new test --package-manager bun --skip-git
   bun create tanstack-start test --yes
   ```

## Frequently Asked Questions

### Q: Do I need to manually run CLI commands?

A: No, the generator runs them automatically. You only need the CLI tools installed.

### Q: Can I customize CLI scaffold options?

A: Yes, edit `scaffoldNestJsProject()` and `scaffoldTanStackProject()` methods to pass different flags.

### Q: What if CLI is not installed?

A: Generator continues with manual setup (Phase 2 still works). Consider installing CLI tools for best results.

### Q: How do I use the old single-phase generator?

A: Check out an earlier version of the repository or comment out Phase 1 methods.

### Q: Can I run Phase 1 and Phase 2 separately?

A: Yes, they're independent methods. You can call them individually for custom workflows.

### Q: Will generated projects be compatible with my existing stack?

A: Yes, Phase 2 templates are backward compatible. Only Phase 1 changes the base structure.
