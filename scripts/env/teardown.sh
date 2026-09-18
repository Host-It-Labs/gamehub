#!/bin/bash
# Removes the generated, never-committed state of one worktree environment so
# `git worktree remove` cannot trip on it. The branch itself is kept by the
# environment engine, so a settled conversation can still be restored.
set -euo pipefail

ENV_DIR="${ENV_DIR:-$PWD}"
cd "$ENV_DIR"

rm -rf .data .env
echo "env ${ENV_SLUG:-$(basename "$ENV_DIR")} cleaned: removed .data and .env"
