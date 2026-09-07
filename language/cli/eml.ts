#!/usr/bin/env bun
/**
 * EML CLI executable shim.
 *
 * Build applications from an EML (.mmd) model describing an ERD, business
 * rules, and workflows. Run with Bun:
 *
 *   bun language/cli/eml.ts <command> [options]
 *   bun language/cli/eml.ts --help
 */

import { run } from "./src/cli.ts";

run(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
