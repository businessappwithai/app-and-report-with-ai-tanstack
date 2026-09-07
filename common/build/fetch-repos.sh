#!/usr/bin/env bash
#
# Fetch the two applications from their own repositories.
#
# This repository is an orchestrator: it holds the glue that runs the generated
# application and the reporting platform together, and neither application's
# source. They are cloned at run time, at a pinned ref, so that what runs is
# whatever those repositories actually say today rather than a vendored copy
# that silently ages.
#
#   common/.runtime/repos/app-with-ai-tanstack
#   common/.runtime/repos/enterprise_reporting_tanstack
#
# Both are then symlinked to the repository root, because two things address
# them by that path and neither can be given a variable:
#
#   - `common/language/cli/src/generate/{jdm,tanstack}.ts` import the shipped
#     JDM converter and generator orchestrator by relative path. They are
#     deliberately not vendored — a second copy is how the CLI and the
#     modelling tool come to disagree about what a rule flow compiles to.
#   - `docker-compose.yml` names them as build contexts.
#
# Pin a ref per repository to make a build reproducible:
#
#   APP_REPO_REF=8f31c7a REPORT_REPO_REF=42a91de ./start.sh
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

readonly REPOS_DIR="common/.runtime/repos"

APP_REPO_URL="${APP_REPO_URL:-https://github.com/businessappwithai/app-with-ai-tanstack.git}"
APP_REPO_REF="${APP_REPO_REF:-main}"
REPORT_REPO_URL="${REPORT_REPO_URL:-https://github.com/businessappwithai/enterprise_reporting_tanstack.git}"
REPORT_REPO_REF="${REPORT_REPO_REF:-main}"

say() { printf '  %s\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# One repository: clone if absent, fetch and hard-reset if present.
#
# Reset rather than pull: this is a build input, not a working copy, and a
# `pull` that hits a conflict leaves a half-merged tree that then fails much
# later, during a docker build, as something that reads like a source error.
fetch_one() {
  local name="$1" url="$2" ref="$3"
  local dir="${REPOS_DIR}/${name}"

  if [[ -d "${dir}/.git" ]]; then
    say "${name}: fetching ${ref}"
    git -C "$dir" remote set-url origin "$url"
    git -C "$dir" fetch --quiet --tags --force origin "$ref" 2>/dev/null \
      || git -C "$dir" fetch --quiet --tags --force origin \
      || die "could not fetch ${url}"
    git -C "$dir" checkout --quiet --force FETCH_HEAD 2>/dev/null \
      || git -C "$dir" checkout --quiet --force "$ref" \
      || die "could not check out ${ref} in ${name}"
  else
    say "${name}: cloning ${ref}"
    mkdir -p "$REPOS_DIR"
    rm -rf "$dir"
    # Not --depth 1: a pinned ref may be any commit, and a shallow clone of
    # `main` cannot check one out.
    git clone --quiet "$url" "$dir" || die "could not clone ${url}"
    git -C "$dir" checkout --quiet --force "$ref" || die "no such ref in ${name}: ${ref}"
  fi

  # The path the glue addresses. A symlink rather than a copy, so there is one
  # tree on disk and `git -C` on it still means something.
  ln -sfn "$(cd "$dir" && pwd)" "./${name}"
  say "${name}: $(git -C "$dir" rev-parse --short HEAD) $(git -C "$dir" log -1 --format=%s | cut -c1-52)"
}

# A real directory where a symlink belongs is a vendored copy from before this
# repository stopped carrying one. Refusing is safer than clobbering it.
for name in app-with-ai-tanstack enterprise_reporting_tanstack; do
  if [[ -e "$name" && ! -L "$name" ]]; then
    die "./${name} is a real directory, not a symlink. This repository fetches
       both applications from their own repositories now. Move or delete it, then
       run this again."
  fi
done

fetch_one app-with-ai-tanstack "$APP_REPO_URL" "$APP_REPO_REF"
fetch_one enterprise_reporting_tanstack "$REPORT_REPO_URL" "$REPORT_REPO_REF"

# app-with-ai-tanstack needs its dependencies on this machine.
#
# The `tanstack-nestjs` target drives that workspace's own generator
# orchestrator in this process, so its imports have to resolve here — a fresh
# clone fails on `Cannot find package 'zod'` at the first generate.
#
# enterprise_reporting_tanstack deliberately gets no install: nothing runs it
# from the host. Its image and the seeder's install inside their own builds.
readonly APP_DIR="${REPOS_DIR}/app-with-ai-tanstack"
readonly STAMP="${APP_DIR}/node_modules/.orchestrator-install-stamp"
if [[ ! -f "$STAMP" ]] || [[ "${APP_DIR}/bun.lock" -nt "$STAMP" ]]; then
  say "app-with-ai-tanstack: installing dependencies (first run takes a minute)"
  (cd "$APP_DIR" && bun install --frozen-lockfile >/dev/null) \
    || die "bun install failed in app-with-ai-tanstack"
  touch "$STAMP"
else
  say "app-with-ai-tanstack: dependencies already installed"
fi
