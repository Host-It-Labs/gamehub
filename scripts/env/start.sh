#!/bin/bash
# Starts the Gamehub development stack (frontend + API) in one command.
#
# Two modes, chosen from the checkout this runs in:
#   - main checkout    → default ports 3017/3018 (or whatever .env says)
#   - managed worktree → the private ports and database from the generated .env
#
# .env is written by scripts/env/setup.sh and carries every value the apps need,
# so this script does not depend on the ENV_* variables the harness passes only
# to lifecycle hooks. That is what lets one script back both the environment
# `start` hook and the workspace action button.
set -euo pipefail

ENV_DIR="${ENV_DIR:-$PWD}"
cd "$ENV_DIR"

if [ -f .env ]; then
	set -a
	# shellcheck disable=SC1091  # generated per worktree, optional in the main checkout
	source .env
	set +a
fi

DEV_PORT="${DEV_PORT:-3017}"
API_PORT="${API_PORT:-3018}"

# Free the ports this environment owns before binding them.
#
# A dev server surviving an earlier run (crashed terminal, closed tab, killed
# harness) keeps its port, and scripts/dev.mjs then refuses to start. Only the
# two ports of THIS environment are touched, so a sibling worktree on its own
# ports keeps running.
free_port() {
	local port=$1 label=$2 pids
	# lsof exits 1 when nothing listens; that is the normal case, not an error.
	pids=$(/usr/sbin/lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2> /dev/null || true)
	[ -n "$pids" ] || return 0

	echo "port $port ($label) busy — stopping pid(s) $(echo "$pids" | tr '\n' ' ')"
	# SIGTERM first so a dev server can release its watchers and child processes.
	kill $pids 2> /dev/null || true
	for _ in $(seq 1 10); do
		pids=$(/usr/sbin/lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2> /dev/null || true)
		[ -n "$pids" ] || return 0
		sleep 1
	done

	kill -9 $pids 2> /dev/null || true
	sleep 1
	if /usr/sbin/lsof -nP -iTCP:"$port" -sTCP:LISTEN -t > /dev/null 2>&1; then
		echo "could not free port $port ($label)" >&2
		exit 1
	fi
}

free_port "$DEV_PORT" frontend
free_port "$API_PORT" api

echo "starting Gamehub frontend :$DEV_PORT and api :$API_PORT (db ${DATABASE_PATH:-.data/gamehub.sqlite})"

# exec so Ctrl-C in the terminal action, or "Stop environment" in the header,
# takes the whole dev stack down instead of orphaning it.
export DEV_PORT API_PORT
exec npm run dev
