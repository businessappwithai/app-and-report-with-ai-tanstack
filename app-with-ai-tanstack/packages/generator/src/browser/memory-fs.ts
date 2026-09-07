/**
 * A filesystem in a Map, so the real generators can run in a browser tab.
 *
 * The alternative was to rewrite the pipeline to emit a `Map<string, string>`
 * instead of writing files — a change across two generators and three thousand
 * lines, leaving two ways to produce an application that would drift the moment
 * anyone edited one. The generators are right as they are: writing files is what
 * generating an application means.
 *
 * So the filesystem moves instead. Every `fs.writeFile` the pipeline makes lands
 * here, every `fs.readFile` of a template is served from the same map, and
 * `snapshot()` hands back what was produced. `scripts/build-fullstack-browser.ts`
 * binds `node:fs` and `node:fs/promises` to this module, which is the only
 * reason the NestJS stack can be assembled somewhere with no disk.
 *
 * It implements exactly the calls the generator graph makes — `access`, `chmod`,
 * `copyFile`, `mkdir`, `readFile`, `readdir`, `stat`, `unlink`, `writeFile`, and
 * the three sync ones — and throws a recognisable ENOENT for anything missing,
 * because several call sites catch that specific failure and mean it.
 */

/** Files, keyed by absolute normalized path. Directories are implicit. */
const files = new Map<string, string>();
/** Directories created explicitly, so `readdir` on an empty one works. */
const dirs = new Set<string>(["/"]);
/** Seeded templates, keyed by their path under `templates/`. See `resolve`. */
const templates = new Map<string, string>();

export function normalize(path: string): string {
  const absolute = path.startsWith("/") ? path : `/${path}`;
  const parts: string[] = [];
  for (const segment of absolute.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return `/${parts.join("/")}`;
}

function parentsOf(path: string): string[] {
  const parts = normalize(path).split("/").filter(Boolean);
  return parts.slice(0, -1).map((_, index) => `/${parts.slice(0, index + 1).join("/")}`);
}

/**
 * Find a template however the generator spelled the path to it.
 *
 * `resolveTemplateDir` tries six candidate locations — relative to the working
 * directory, relative to `__dirname`, a couple of levels up — and picks the
 * first that exists. All six are answers to "where is this repository", which is
 * a question with no meaning in a tab: there is one copy of the templates and it
 * is in a Map.
 *
 * So a miss falls back to matching on everything after `templates/`. Reproducing
 * the resolver's six guesses here instead would mean owning a copy of them, and
 * the seventh spelling someone adds would silently not work.
 */
function asTemplate(path: string): string | undefined {
  const marker = path.lastIndexOf("/templates/");
  if (marker === -1) return undefined;
  return templates.get(path.slice(marker + "/templates/".length));
}

function enoent(path: string): NodeJS.ErrnoException {
  const error = new Error(
    `ENOENT: no such file or directory, open '${path}'`
  ) as NodeJS.ErrnoException;
  error.code = "ENOENT";
  error.errno = -2;
  error.path = path;
  return error;
}

const asText = (data: unknown): string =>
  typeof data === "string"
    ? data
    : data instanceof Uint8Array
      ? new TextDecoder().decode(data)
      : String(data);

/* ------------------------------------------------------------------ control */

/** Put a set of files in place — the templates, before anything is generated. */
export function seed(entries: Record<string, string>, at = "/"): void {
  for (const [path, content] of Object.entries(entries)) {
    const full = normalize(`${at}/${path}`);
    files.set(full, content);
    templates.set(path.replace(/^\/+/, ""), content);
    for (const dir of parentsOf(full)) dirs.add(dir);
  }
}

/** Everything written under `root`, keyed by its path relative to it. */
export function snapshot(root: string): Record<string, string> {
  const prefix = normalize(root).replace(/\/$/, "");
  const out: Record<string, string> = {};
  for (const [path, content] of files) {
    if (path === prefix || !path.startsWith(`${prefix}/`)) continue;
    out[path.slice(prefix.length + 1)] = content;
  }
  return out;
}

/** Forget everything. Two generations in one tab must not see each other. */
export function reset(): void {
  files.clear();
  templates.clear();
  dirs.clear();
  dirs.add("/");
}

/* -------------------------------------------------------------- fs/promises */

export async function writeFile(path: string, data: unknown): Promise<void> {
  const full = normalize(String(path));
  files.set(full, asText(data));
  for (const dir of parentsOf(full)) dirs.add(dir);
}

export async function readFile(path: string, _encoding?: unknown): Promise<string> {
  const full = normalize(String(path));
  const content = files.get(full) ?? asTemplate(full);
  if (content === undefined) throw enoent(full);
  return content;
}

export async function mkdir(path: string, _options?: unknown): Promise<undefined> {
  const full = normalize(String(path));
  dirs.add(full);
  for (const dir of parentsOf(full)) dirs.add(dir);
  return undefined;
}

export async function readdir(
  path: string,
  options?: { withFileTypes?: boolean }
): Promise<unknown[]> {
  const prefix = normalize(String(path)).replace(/\/$/, "");
  const names = new Set<string>();
  const directories = new Set<string>();

  for (const file of files.keys()) {
    if (!file.startsWith(`${prefix}/`)) continue;
    const rest = file.slice(prefix.length + 1);
    const [head] = rest.split("/");
    if (!head) continue;
    names.add(head);
    if (rest.includes("/")) directories.add(head);
  }
  for (const dir of dirs) {
    if (!dir.startsWith(`${prefix}/`)) continue;
    const head = dir.slice(prefix.length + 1).split("/")[0];
    if (head) {
      names.add(head);
      directories.add(head);
    }
  }

  // Whole directories of templates are copied recursively, and those reads
  // arrive under whichever path `resolveTemplateDir` chose — so listing falls
  // back to the template index for the same reason reading does.
  const marker = prefix.lastIndexOf("/templates/");
  if (marker !== -1) {
    const under = `${prefix.slice(marker + "/templates/".length)}/`;
    for (const key of templates.keys()) {
      if (!key.startsWith(under)) continue;
      const rest = key.slice(under.length);
      const head = rest.split("/")[0];
      if (!head) continue;
      names.add(head);
      if (rest.includes("/")) directories.add(head);
    }
  }

  const sorted = [...names].sort();
  if (!options?.withFileTypes) return sorted;
  return sorted.map((name) => ({
    name,
    isDirectory: () => directories.has(name),
    isFile: () => !directories.has(name),
  }));
}

export async function copyFile(from: string, to: string): Promise<void> {
  await writeFile(to, await readFile(from));
}

export async function access(path: string): Promise<void> {
  if (!existsSync(String(path))) throw enoent(normalize(String(path)));
}

export async function stat(path: string): Promise<{
  isDirectory: () => boolean;
  isFile: () => boolean;
  size: number;
}> {
  const full = normalize(String(path));
  if (files.has(full)) {
    return { isDirectory: () => false, isFile: () => true, size: files.get(full)!.length };
  }
  if (dirs.has(full)) return { isDirectory: () => true, isFile: () => false, size: 0 };
  const template = asTemplate(full);
  if (template !== undefined) {
    return { isDirectory: () => false, isFile: () => true, size: template.length };
  }
  if (existsSync(full)) return { isDirectory: () => true, isFile: () => false, size: 0 };
  throw enoent(full);
}

export async function unlink(path: string): Promise<void> {
  files.delete(normalize(String(path)));
}

export async function rm(path: string, _options?: unknown): Promise<void> {
  const prefix = normalize(String(path));
  files.delete(prefix);
  for (const file of [...files.keys()]) {
    if (file.startsWith(`${prefix}/`)) files.delete(file);
  }
  for (const dir of [...dirs]) {
    if (dir === prefix || dir.startsWith(`${prefix}/`)) dirs.delete(dir);
  }
}

/** Permissions mean nothing here; the call has to succeed, not do something. */
export async function chmod(_path: string, _mode: number): Promise<void> {}

/* --------------------------------------------------------------- sync forms */

export function existsSync(path: string): boolean {
  const full = normalize(String(path));
  if (files.has(full) || dirs.has(full)) return true;
  if (asTemplate(full) !== undefined) return true;
  // `resolveTemplateDir` asks whether a *directory* of templates is there.
  const marker = full.lastIndexOf("/templates/");
  if (marker === -1) return false;
  const prefix = `${full.slice(marker + "/templates/".length)}/`;
  for (const key of templates.keys()) if (key.startsWith(prefix)) return true;
  return false;
}

export function readFileSync(path: string, _encoding?: unknown): string {
  const full = normalize(String(path));
  const content = files.get(full) ?? asTemplate(full);
  if (content === undefined) throw enoent(full);
  return content;
}

export function writeFileSync(path: string, data: unknown): void {
  const full = normalize(String(path));
  files.set(full, asText(data));
  for (const dir of parentsOf(full)) dirs.add(dir);
}

export function mkdirSync(path: string, _options?: unknown): void {
  const full = normalize(String(path));
  dirs.add(full);
  for (const dir of parentsOf(full)) dirs.add(dir);
}

export function copyFileSync(from: string, to: string): void {
  writeFileSync(to, readFileSync(from));
}

export function readdirSync(path: string): string[] {
  const prefix = normalize(String(path)).replace(/\/$/, "");
  const names = new Set<string>();
  for (const file of files.keys()) {
    if (!file.startsWith(`${prefix}/`)) continue;
    const head = file.slice(prefix.length + 1).split("/")[0];
    if (head) names.add(head);
  }
  const marker = prefix.lastIndexOf("/templates/");
  if (marker !== -1) {
    const under = `${prefix.slice(marker + "/templates/".length)}/`;
    for (const key of templates.keys()) {
      if (!key.startsWith(under)) continue;
      const head = key.slice(under.length).split("/")[0];
      if (head) names.add(head);
    }
  }
  return [...names].sort();
}

export function statSync(path: string) {
  const full = normalize(String(path));
  if (files.has(full)) return { isDirectory: () => false, isFile: () => true };
  if (dirs.has(full)) return { isDirectory: () => true, isFile: () => false };
  if (asTemplate(full) !== undefined) return { isDirectory: () => false, isFile: () => true };
  if (existsSync(full)) return { isDirectory: () => true, isFile: () => false };
  throw enoent(full);
}

/** `import { promises as fs } from "node:fs"` is how several call sites reach it. */
export const promises = {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
};

export default {
  ...promises,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  statSync,
  promises,
};
