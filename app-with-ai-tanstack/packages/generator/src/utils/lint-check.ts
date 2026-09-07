import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export interface LintCheckOptions {
  skipBackend?: boolean;
  skipFrontend?: boolean;
  /** The package manager the project was generated for. */
  packageManager?: string;
}

/**
 * Lint the generated application, after its dependencies exist.
 *
 * This used to run at the end of generation, inside the generator. At that
 * point nothing is installed, so `<pm> run lint` could not find biome and
 * failed — and the check reported "linting found issues" on every generation
 * regardless of the code it had never managed to read. A check that cannot
 * pass says nothing; this one is called from the CLI after the install step,
 * and where there is still no `node_modules` it says *that* instead of
 * inventing a finding.
 */
export async function runLintingChecks(
  outputDir: string,
  options: LintCheckOptions = {}
): Promise<void> {
  const pm = options.packageManager || "npm";

  const lint = (cwd: string): "passed" | "failed" | "skipped" => {
    if (!existsSync(path.join(cwd, "node_modules"))) return "skipped";
    try {
      execFileSync(pm, ["run", "lint"], { cwd, stdio: "pipe", timeout: 120000 });
      return "passed";
    } catch {
      return "failed";
    }
  };

  const report = (label: string, dir: string, result: ReturnType<typeof lint>) => {
    if (result === "passed") console.log(`  ✅ ${label} linting passed`);
    else if (result === "skipped")
      console.log(`  ⏭️  ${label} linting skipped — no dependencies installed in ${dir}/`);
    else
      console.warn(
        `  ⚠️  ${label} linting found issues (run "cd ${dir} && ${pm} run lint:fix" to auto-fix)`
      );
  };

  if (!options.skipBackend) {
    console.log("\n  📋 Linting NestJS backend...");
    report("Backend", "backend", lint(path.join(outputDir, "backend")));
  }

  if (!options.skipFrontend) {
    console.log("\n  📋 Linting TanStack Start frontend...");
    report("Frontend", "frontend", lint(path.join(outputDir, "frontend")));
  }

  console.log("\n✨ Linting checks completed!");
}
