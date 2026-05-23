#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm was not found. Run scripts/setup.ps1 or install pnpm 8.x first." >&2
  exit 1
fi

pnpm dev
