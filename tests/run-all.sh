#!/usr/bin/env bash
set -e
node tools/build-css.mjs
node tools/audit-unused.mjs
node --test tests/*.test.mjs
