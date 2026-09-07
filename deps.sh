#!/usr/bin/env bash
#
# Place the two product repositories this one orchestrates, at the commits
# deps.json pins.
#
#   ./deps.sh              clone or update both to their pinned refs
#   ./deps.sh --install    also `bun install --frozen-lockfile` in each
#   ./deps.sh --status     say what is checked out, and whether it matches
#   ./deps.sh --update     resolve each branch to its head and rewrite deps.json
#
# The checkouts land beside this repository's own folders and are gitignored.
# CI does the same thing with actions/checkout, reading the same deps.json.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

command -v bun >/dev/null 2>&1 || {
  echo "bun is not installed. deps.json is read with bun, as is everything else here." >&2
  exit 1
}

exec bun common/scripts/deps.ts "$@"
