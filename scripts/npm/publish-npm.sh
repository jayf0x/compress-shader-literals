#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.bun/bin:$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"

# ── git sanity checks ─────────────────────────────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" != "main" ]] && { echo "✗ Must be on main (currently: $BRANCH)"; exit 1; }

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "✗ Uncommitted changes — stash or commit first"
  exit 1
fi

# ── build + typecheck + test ─────────────────────────────────────────────────
bun run scan
bun run build
bun run typecheck
bun run test
node tests/build-smoke.js   # dist/ (ESM + CJS) actually loads and transforms

# ── refresh real-world stats (local only) ────────────────────────────────────
( cd tests && bun install && node e2e.js --write )
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

# ── release notes (changelog.md) ───────────────────────────────────────────────
# Summarizes the commits since the last tag via `claude -p`; never fatal, and the commit below
# picks the changes up either way.
bun "$(dirname "$0")/release-notes.ts" "$NEW" || echo "! release notes step failed — continuing"

bun run format

# ── commit + tag + push (GHA workflow handles npm publish) ────────────────────
git add .
git commit -m "chore: release $NEW"
git tag "$TAG"
git push origin HEAD
git push origin "$TAG"

echo ""
echo "✓ Tagged $TAG — GitHub Actions will publish to npm"
echo "  https://github.com/jayf0x/compress-shader-literals/actions"
