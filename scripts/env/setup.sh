#!/bin/bash
# Per-worktree environment setup (run once by the harness after `git worktree add`).
# Receives ENV_SLUG, ENV_DIR, ENV_ROOT, ENV_BRANCH, ENV_INDEX, ENV_PORT_0 (frontend), ENV_PORT_1 (api).
set -euo pipefail

# Fail loudly when this is run by hand instead of by the environment engine.
: "${ENV_SLUG:?ENV_SLUG missing (run this through the harness environment setup hook)}"
: "${ENV_DIR:?ENV_DIR missing}"
: "${ENV_ROOT:?ENV_ROOT missing}"
: "${ENV_PORT_0:?ENV_PORT_0 missing (frontend port)}"
: "${ENV_PORT_1:?ENV_PORT_1 missing (api port)}"

cd "$ENV_DIR"

# node_modules is symlinked from the main checkout by the harness (see .agents/env.json "share").
# If the lockfile diverged from the main checkout, install privately instead.
if [ -L node_modules ] && ! cmp -s package-lock.json "$ENV_ROOT/package-lock.json"; then
  rm node_modules && npm ci --no-audit --no-fund
fi

# Own ports, own origin, own sqlite database (relative path => inside this worktree).
cat > .env <<ENV
DEV_PORT=$ENV_PORT_0
API_PORT=$ENV_PORT_1
PUBLIC_ORIGIN=http://localhost:$ENV_PORT_0
DATABASE_PATH=.data/gamehub.sqlite
ENV
mkdir -p .data
echo "env $ENV_SLUG ready: http://localhost:$ENV_PORT_0 (api :$ENV_PORT_1), db .data/gamehub.sqlite"
