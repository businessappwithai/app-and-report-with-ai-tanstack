#!/usr/bin/env bun
/**
 * Bundle the *real* stack's generator for the browser.
 *
 * `build-wasm-browser.ts` bundles the self-contained runtime's generator, whose
 * every dependency is already pure. This one bundles the pipeline that writes
 * four hundred files of NestJS and React — code that reads templates off disk
 * and writes an application to it, neither of which a tab has.
 *
 * Rather than rewrite that pipeline to emit a Map, the filesystem it calls is
 * replaced: `node:fs` and `node:fs/promises` resolve to `memory-fs.ts`, and the
 * generators run unmodified above it. That is the only reason the application
 * assembled in `run-real-stack.html` is the application `appwithai-wasm` would
 * have written rather than an approximation of it.
 *
 * The templates are not bundled — `build-stack-templates.ts` writes them beside
 * the page as JSON, because 1.8MB of Handlebars does not belong in a script tag.
 *
 *   bun run build:fullstack-browser
 *   bun run build:fullstack-browser --check
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { bundlerEnvNotice } from "./lib/build-env.ts";

const ROOT = resolve(import.meta.dir, "..");
const ENTRY = join(ROOT, "packages/generator/src/browser/full-stack.ts");
const TARGET = join(ROOT, "html/assets/appwithai-fullstack.js");
const MEMORY_FS = join(ROOT, "packages/generator/src/browser/memory-fs.ts");

/**
 * Node builtins the pipeline names, and what they become in a tab.
 *
 * `fs` is the interesting one and the point of the exercise. The rest are the
 * usual suspects — path arithmetic is string manipulation, `url` is one regex,
 * and `child_process` is only reached by code paths (installing, migrating) that
 * a WebContainer performs itself and this bundle never runs.
 */
const stubs: Record<string, string> = {
  "node:path":
    "const norm = (p) => String(p).replace(/\\/+/g, '/');\n" +
    "export const sep = '/';\n" +
    "export const dirname = (p) => norm(p).replace(/\\/[^/]*$/, '') || '/';\n" +
    "export const basename = (p, ext) => { const b = norm(p).split('/').pop() || ''; return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; };\n" +
    "export const extname = (p) => { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; };\n" +
    "export const join = (...parts) => norm(parts.filter(Boolean).join('/')) || '.';\n" +
    "export const resolve = (...parts) => { const j = join(...parts); return j.startsWith('/') ? j : '/' + j; };\n" +
    "export const relative = (from, to) => { const f = resolve(from).split('/'), t = resolve(to).split('/'); let i = 0; while (i < f.length && i < t.length && f[i] === t[i]) i++; return [...Array(f.length - i).fill('..'), ...t.slice(i)].join('/'); };\n" +
    "export const isAbsolute = (p) => String(p).startsWith('/');\n" +
    "export default { sep, dirname, basename, extname, join, resolve, relative, isAbsolute };",
  "node:url":
    "export const fileURLToPath = (url) => String(url).replace(/^file:\\/\\//, '');\n" +
    "export const pathToFileURL = (p) => ({ href: 'file://' + p });\n" +
    "export default { fileURLToPath, pathToFileURL };",
  "node:child_process":
    "const refuse = () => { throw new Error('no subprocesses in the browser'); };\n" +
    "export const spawn = refuse, spawnSync = refuse, exec = refuse, execSync = refuse;\n" +
    "export default { spawn, spawnSync, exec, execSync };",
  "node:os":
    "export const tmpdir = () => '/tmp';\nexport const homedir = () => '/home';\n" +
    "export const platform = () => 'browser';\nexport const userInfo = () => ({ username: 'browser' });\n" +
    "export default { tmpdir, homedir, platform, userInfo };",
};

const plugin: import("bun").BunPlugin = {
  name: "browser-filesystem",
  setup(build) {
    // The whole point: every fs call the generators make lands in a Map.
    build.onResolve({ filter: /^node:fs(\/promises)?$/ }, () => ({ path: MEMORY_FS }));
    build.onResolve({ filter: /^node:(path|url|child_process|os)$/ }, (args) => ({
      path: args.path,
      namespace: "builtin-stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "builtin-stub" }, (args) => ({
      contents: stubs[args.path] ?? "export default {};",
      loader: "js",
    }));
  },
};

/**
 * A `process`, for code that has every right to expect one.
 *
 * The pipeline reads `process.cwd()` to find its templates, `process.env` for
 * flags and `process.stdout.isTTY` to decide about colour — all reasonable of a
 * Node program, and all absent in a tab. This is prepended rather than patched
 * into the source, because the source is right and the environment is the thing
 * that is missing something.
 *
 * `cwd()` is `/` on purpose: `resolveTemplateDir` joins it with
 * `packages/generator/templates`, and memory-fs resolves whatever that produces
 * back to the seeded templates by suffix.
 */
const processShim = `
globalThis.process ??= {
  cwd: () => "/",
  env: {},
  argv: [],
  platform: "browser",
  versions: {},
  exit: () => {},
  nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
  stdout: { isTTY: false, write: (text) => console.log(String(text).trimEnd()) },
  stderr: { isTTY: false, write: (text) => console.warn(String(text).trimEnd()) },
};
globalThis.__dirname ??= "/";
globalThis.__filename ??= "/index.js";
`;

// Bun labels each bundled module with its path *relative to the working
// directory*, so a build from anywhere but the repository root produced a
// different file and `--check` failed on CI while passing locally. A build
// artifact that is only reproducible from one directory is not reproducible.
process.chdir(ROOT);

const result = await Bun.build({
  plugins: [plugin],
  entrypoints: [ENTRY],
  target: "browser",
  format: "esm",
  minify: false,
  banner: processShim,
  // Without these the bundler inlines the absolute path this ran from, so the
  // output differs on every machine and `--check` can never pass anywhere but
  // the one that produced it. `/` is also the right answer: `resolveTemplateDir`
  // joins it with a templates path, and memory-fs resolves whatever that makes
  // back to the seeded templates by suffix.
  define: {
    __dirname: '"/"',
    __filename: '"/index.js"',
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const code = await result.outputs[0]!.text();

if (process.argv.includes("--check")) {
  const existing = await readFile(TARGET, "utf-8").catch(() => "");
  if (existing !== code) {
    console.error(
      `${relative(ROOT, TARGET)} is out of date.\nRun: bun run build:fullstack-browser`
    );
    console.error(bundlerEnvNotice(ROOT));
    process.exit(1);
  }
  console.log(`✓ ${relative(ROOT, TARGET)} is up to date`);
} else {
  await writeFile(TARGET, code, "utf-8");
  console.log(
    `✓ bundled the full-stack generator to ${relative(ROOT, TARGET)} ` +
      `(${(Buffer.byteLength(code) / 1024).toFixed(0)}KB)`
  );
}
