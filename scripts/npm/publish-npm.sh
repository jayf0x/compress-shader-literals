#!/usr/bin/env bash
set -euo pipefail

# ── git sanity checks ─────────────────────────────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" != "main" ]] && { echo "✗ Must be on main (currently: $BRANCH)"; exit 1; }

NAME=$(node -p "require('./package.json').name")
if ! npm view "$NAME" version >/dev/null 2>&1; then
  echo "✗ $NAME has never been published — run 'bun run repo:bootstrap' first (trusted"
  echo "  publishing can't be configured on npmjs.com until a first version exists)"
  exit 1
fi

# ── build + typecheck + test ─────────────────────────────────────────────────
bun run scan
bun run build
bun run typecheck
bun run test
bun run format

# ── version bump ──────────────────────────────────────────────────────────────
# This release flow is patch-only; any non-patch BUMP value is rejected.
NEW=$(bun "$(dirname "$0")/patch-json.ts")
TAG="v$NEW"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "✗ Tag $TAG already exists — was a previous publish interrupted?"
  exit 1
fi
echo "Bumped to $NEW"

# ── release notes (CHANGELOG.md + README's "What's new" table) ────────────────
# Summarizes the commits since the last tag via `claude -p`; never fatal, and the commit below
# picks the changes up either way.
bun "$(dirname "$0")/release-notes.ts" "$NEW" || echo "! release notes step failed — continuing"

# ── commit + tag + push (GHA workflow handles npm publish) ────────────────────
git add .
git commit -m "chore: release $NEW" >/dev/null 2>&1
git tag "$TAG"
git push origin HEAD
git push origin "$TAG"

echo ""
echo "✓ Tagged $TAG — GitHub Actions will publish to npm"


