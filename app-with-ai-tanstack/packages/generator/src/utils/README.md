# Generator Utilities

## CLI Executor (`cli-executor.ts`)

A utility class for executing external CLI commands safely with error handling and logging.

### Usage

```typescript
import { CliExecutor } from './utils/cli-executor';

// Execute synchronously
const output = CliExecutor.executeSync('nest', [
  'new',
  'my-project',
  '--package-manager', 'bun'
], {
  cwd: '/path/to/projects',
  stdio: 'inherit'
});

// Execute asynchronously
const output = await CliExecutor.executeAsync('bun', [
  'create',
  'tanstack-start@latest',
  'my-project'
], {
  cwd: '/path/to/projects',
  stdio: 'inherit',
  timeout: 600000 // 10 minutes
});

// Check if command is available
if (CliExecutor.isCommandAvailable('nest')) {
  console.log('NestJS CLI is installed');
}

// Get command version
const version = CliExecutor.getCommandVersion('nest');
console.log(`NestJS CLI version: ${version}`);

// Directory operations
const isEmpty = await CliExecutor.isDirectoryEmpty('/path/to/dir');
await CliExecutor.removeDirectory('/path/to/dir');
await CliExecutor.copyDirectory('/source', '/destination');
```

### Methods

#### `executeSync(command, args, options?): string`

Execute a command synchronously and return its output.

**Parameters:**
- `command: string` - The command to execute (e.g., 'nest', 'bun')
- `args: string[]` - Array of command arguments
- `options?: CliExecutorOptions` - Execution options

**Returns:** Command output as string

**Throws:** Error if command fails

**Options:**
```typescript
interface CliExecutorOptions {
  cwd?: string;              // Working directory
  env?: NodeJS.ProcessEnv;   // Environment variables
  stdio?: 'pipe' | 'inherit'; // Output handling
  timeout?: number;          // Timeout in milliseconds (default: 300000 = 5m)
}
```

#### `executeAsync(command, args, options?): Promise<string>`

Execute a command asynchronously and return its output.

**Parameters:**
- Same as `executeSync`

**Returns:** Promise that resolves to command output

**Notes:**
- Handles timeouts gracefully
- Better for long-running operations (CLI scaffolding)
- Supports both `pipe` and `inherit` stdio modes

#### `isCommandAvailable(command): boolean`

Check if a command exists in the system PATH.

**Parameters:**
- `command: string` - Command name to check

**Returns:** `true` if command is available, `false` otherwise

**Example:**
```typescript
if (!CliExecutor.isCommandAvailable('nest')) {
  console.warn('Install NestJS CLI with: npm install -g @nestjs/cli');
}
```

#### `getCommandVersion(command, versionFlag?): string | null`

Get the version of an installed CLI tool.

**Parameters:**
- `command: string` - Command name
- `versionFlag?: string` - Version flag (default: '--version')

**Returns:** Version string or `null` if command not found

**Example:**
```typescript
const nestVersion = CliExecutor.getCommandVersion('nest');
const bunVersion = CliExecutor.getCommandVersion('bun', '--version');
```

#### `isDirectoryEmpty(dirPath): Promise<boolean>`

Check if a directory is empty or doesn't exist.

**Parameters:**
- `dirPath: string` - Path to directory

**Returns:** Promise resolving to `true` if empty/non-existent

#### `removeDirectory(dirPath): Promise<void>`

Remove a directory and all its contents recursively.

**Parameters:**
- `dirPath: string` - Path to directory to remove

**Notes:**
- Fails gracefully with warning
- Safe to call on non-existent directories

#### `copyDirectory(src, dest): Promise<void>`

Copy a directory and all its contents recursively.

**Parameters:**
- `src: string` - Source directory path
- `dest: string` - Destination directory path

**Throws:** Error if copy fails

## Best Practices

### 1. Use `executeAsync` for CLI Scaffolding

```typescript
// Good: Async for potentially long operations
await CliExecutor.executeAsync('nest', ['new', 'project'], {
  stdio: 'inherit',
  timeout: 600000
});

// Avoid: Sync blocking can freeze the app
const result = CliExecutor.executeSync('bun', ['create', 'tanstack-start', 'project']);
```

### 2. Set Appropriate Timeouts

```typescript
// NestJS CLI (usually fast)
await CliExecutor.executeAsync('nest', [...args], {
  timeout: 300000 // 5 minutes
});

// TanStack Start (installs dependencies, slower)
await CliExecutor.executeAsync('bun', ['create', ...args], {
  timeout: 600000 // 10 minutes
});
```

### 3. Handle Errors Gracefully

```typescript
try {
  await CliExecutor.executeAsync('nest', ['new', 'project'], options);
} catch (error) {
  console.warn('NestJS scaffolding failed, proceeding without it');
  // Fall back to manual directory creation
  await createDirectoryStructure(outputDir);
}
```

### 4. Use `stdio: 'inherit'` for User Feedback

```typescript
// User sees real-time progress
await CliExecutor.executeAsync('nest', ['new', 'project'], {
  stdio: 'inherit'
});

// Only use 'pipe' if you need to capture output
const output = CliExecutor.executeSync('nest', ['--version'], {
  stdio: 'pipe'
});
```

### 5. Check Command Availability First

```typescript
if (!CliExecutor.isCommandAvailable('nest')) {
  console.log('Using: bunx nest new project');
  await CliExecutor.executeAsync('bunx', ['nest', 'new', 'project'], options);
} else {
  console.log('Using: nest new project');
  await CliExecutor.executeAsync('nest', ['new', 'project'], options);
}
```

## Error Messages

### Command Not Found

```
❌ Failed to start process: nest
Error: Command not found
```

**Solution:** Install the CLI globally or use `bunx` prefix

### Command Failed

```
❌ Command failed with code 1: nest new my-project
Error output:
  [Nest] 12345 - 01/15/2025, 10:30:45 AM LOG [NestFactory] ...
```

**Solution:** Check the error output and fix issues (e.g., invalid project name, insufficient permissions)

### Command Timeout

```
❌ Command timeout after 300000ms: bun create tanstack-start my-project
```

**Solution:** Increase timeout value in options

## Related Files

- `packages/generator/src/generators/tanstack-start-nestjs/nestjs-backend.generator.ts` - Uses CLI Executor for NestJS scaffolding
- `packages/generator/src/generators/tanstack-start-nestjs/tanstack-frontend.generator.ts` - Uses CLI Executor for TanStack Start scaffolding
- `packages/generator/TWO_PHASE_GENERATION.md` - Architecture documentation

## Future Enhancements

- [ ] Add support for progress callbacks
- [ ] Implement retry logic with exponential backoff
- [ ] Cache command availability checks
- [ ] Support for environment-specific configurations
- [ ] Streaming output capture for long operations
