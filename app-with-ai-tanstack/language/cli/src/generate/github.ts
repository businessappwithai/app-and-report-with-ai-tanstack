/**
 * GitHub publisher.
 *
 * Initializes a git repository in the generated app, commits, and (when a token
 * is available) creates a GitHub repository and pushes to it. Degrades
 * gracefully: with no token it still initializes+commits locally and prints the
 * manual steps, rather than failing the whole generation.
 *
 * Auth: a Personal Access Token from `--github-token` or the GITHUB_TOKEN /
 * GH_TOKEN environment variable (repo scope).
 */

import { spawnSync } from "node:child_process";

export interface GithubOptions {
  /** "owner/repo" or just "repo" (owner resolved from the token's user). */
  target: string;
  token?: string;
  private?: boolean;
  outDir: string;
}

export interface GithubResult {
  ok: boolean;
  repoUrl?: string;
  pushed: boolean;
  messages: string[];
}

function git(args: string[], cwd: string): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

export async function publishToGithub(opts: GithubOptions): Promise<GithubResult> {
  const messages: string[] = [];
  const token = opts.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  // Ensure git exists.
  if (!git(["--version"], opts.outDir).ok) {
    return { ok: false, pushed: false, messages: ["git is not installed or not on PATH."] };
  }

  // Local repo: init + commit (idempotent).
  if (!git(["rev-parse", "--is-inside-work-tree"], opts.outDir).ok) {
    git(["init", "-b", "main"], opts.outDir);
    messages.push("Initialized git repository (branch main).");
  }
  git(["add", "-A"], opts.outDir);
  const commit = git(
    ["commit", "-m", "Initial commit — generated from EML by the APPWITHAI CLI"],
    opts.outDir
  );
  messages.push(commit.ok ? "Created commit." : "Nothing new to commit.");

  const { owner, repo } = splitTarget(opts.target);

  if (!token) {
    messages.push(
      "No GitHub token (set GITHUB_TOKEN or pass --github-token) — skipped remote creation.",
      `To publish manually: create ${owner ? `${owner}/` : ""}${repo} on GitHub, then:`,
      `  git -C "${opts.outDir}" remote add origin <url> && git -C "${opts.outDir}" push -u origin main`
    );
    return { ok: true, pushed: false, messages };
  }

  // Resolve owner from the authenticated user when not provided.
  let resolvedOwner = owner;
  if (!resolvedOwner) {
    const me = await ghApi("GET", "/user", token);
    if (!me.ok)
      return {
        ok: false,
        pushed: false,
        messages: [...messages, `GitHub auth failed: ${me.error}`],
      };
    resolvedOwner = String(me.data?.login ?? "");
  }

  // Create the repo (ignore "already exists").
  const create = await ghApi("POST", "/user/repos", token, {
    name: repo,
    private: opts.private ?? true,
    auto_init: false,
    description: "Generated from an EML model by the APPWITHAI CLI",
  });
  if (!create.ok && !/name already exists/i.test(create.error ?? "")) {
    messages.push(`Could not create repo (${create.error}); assuming it exists and continuing.`);
  } else if (create.ok) {
    messages.push(`Created GitHub repository ${resolvedOwner}/${repo}.`);
  }

  const remoteUrl = `https://${token}@github.com/${resolvedOwner}/${repo}.git`;
  const repoUrl = `https://github.com/${resolvedOwner}/${repo}`;

  git(["remote", "remove", "origin"], opts.outDir);
  git(["remote", "add", "origin", remoteUrl], opts.outDir);
  const push = git(["push", "-u", "origin", "main"], opts.outDir);
  if (push.ok) {
    messages.push(`Pushed to ${repoUrl}.`);
    // Scrub the token from the stored remote.
    git(["remote", "set-url", "origin", `${repoUrl}.git`], opts.outDir);
    return { ok: true, pushed: true, repoUrl, messages };
  }
  git(["remote", "set-url", "origin", `${repoUrl}.git`], opts.outDir);
  return { ok: false, pushed: false, repoUrl, messages: [...messages, `Push failed: ${push.out}`] };
}

function splitTarget(target: string): { owner?: string; repo: string } {
  const parts = target.split("/");
  // Only "owner/repo" carries an owner; anything else is treated as a bare
  // repo name, which is what the original two-part test did.
  return parts.length === 2
    ? { owner: parts[0] ?? "", repo: parts[1] ?? "" }
    : { repo: parts[0] ?? "" };
}

async function ghApi(
  method: string,
  pathname: string,
  token: string,
  body?: unknown
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "appwithai-eml-cli",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.message || `HTTP ${res.status}` };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}
