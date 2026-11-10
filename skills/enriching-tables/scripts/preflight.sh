#!/usr/bin/env bash
# Preflight check for @brightdata/enrich.
# Verifies Node >= 20 and that all four credentials resolve — without spending anything.
# Usage: bash scripts/preflight.sh path/to/input.csv
#
# The credential check works by running `enrich ... --dry-run`, which resolves config
# (env > .env > stored login config) and exits before making any API call. Exit 0 means
# you're clear to run a real enrichment; any non-zero exit prints what to fix.

set -u

CSV="${1:-}"
if [ -z "$CSV" ]; then
  echo "usage: bash scripts/preflight.sh path/to/input.csv" >&2
  exit 2
fi
if [ ! -f "$CSV" ]; then
  echo "✗ input CSV not found: $CSV" >&2
  exit 2
fi

fail=0

# --- Node >= 20 -------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js not found. Install Node >= 20: https://nodejs.org" >&2
  fail=1
else
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$major" -lt 20 ]; then
    echo "✗ Node $(node -v) is too old; @brightdata/enrich needs Node >= 20." >&2
    fail=1
  else
    echo "✓ Node $(node -v)"
  fi
fi

[ "$fail" -ne 0 ] && exit 1

# --- Credentials, via a dry run (no API spend) ------------------------------
# --describe is required by the CLI; the value is irrelevant for a dry run.
echo "• Resolving credentials and config (dry run, no spend)..."
out="$(npx --yes @brightdata/enrich "$CSV" --describe "industry" --dry-run 2>&1)"
code=$?

if [ "$code" -eq 0 ]; then
  echo "$out"
  echo "✓ Preflight passed — credentials resolve and config is valid. Clear to run a real enrichment."
  exit 0
fi

echo "$out" >&2
if echo "$out" | grep -qi "missing credentials"; then
  echo "" >&2
  echo "✗ One or more credentials are missing (see ✗ marks above)." >&2
  echo "  Fix: run \`enrich login\`, or export the missing vars, then re-run preflight." >&2
  echo "  First-time setup walkthrough: references/onboarding.md" >&2
else
  echo "" >&2
  echo "✗ Preflight failed (exit $code). See message above; references/troubleshooting.md may help." >&2
fi
exit 1
