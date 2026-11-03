#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

rm -rf -- \
  "$repo_root/node_modules" \
  "$repo_root/.next" \
  "$repo_root/.vinext" \
  "$repo_root/out" \
  "$repo_root/dist" \
  "$repo_root/coverage"
