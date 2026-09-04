#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
status=0
for test in test-*.mjs; do
  printf '>>> %s\n' "$test"
  if ! node "$test"; then status=1; fi
done
exit "$status"
node tests/test-foundry-update-manifest.mjs
