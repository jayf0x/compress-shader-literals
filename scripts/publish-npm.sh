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

# ── version bump ──────────────────────────────────────────────────────────────
CURRENT=$(bun -e "import pkg from './package.json' with {type:'json'}; process.stdout.write(pkg.version)")
MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)

BUMP="${BUMP:-patch}"
case "$BUMP" in
  major) MAJOR=$((MAJOR+1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR+1)); PATCH=0 ;;
  patch) PATCH=$((PATCH+1)) ;;
  *) echo "✗ Unknown BUMP: $BUMP (patch/minor/major)"; exit 1 ;;
esac

NEW="$MAJOR.$MINOR.$PATCH"
TAG="v$NEW"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "✗ Tag $TAG already exists — was a previous publish interrupted?"
  exit 1
fi

echo "Bumping $CURRENT → $NEW"

bun -e "
  import { readFileSync, writeFileSync } from 'fs';
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW';
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# ── build + typecheck + test ─────────────────────────────────────────────────
bun run build
bun run typecheck
bun run test
node tests/build-smoke.js   # dist/ (ESM + CJS) actually loads and transforms

# ── refresh real-world stats (local only) ────────────────────────────────────
( cd tests && bun install && node e2e.js --write )
bun run format

# ── update changelog.md via Claude Code CLI ───────────────────────────────────
# PREV_TAG is the latest existing tag — the new $TAG isn't created until below.
PREV_TAG=$(git tag --sort=-version:refname | grep "^v" | head -1)
COMMIT_LOG=$(git log --oneline "$PREV_TAG"..HEAD 2>/dev/null || git log --oneline | head -20)

echo ""
echo "Updating changelog.md (Claude Code)..."

claude \
  --model haiku \
  --no-session-persistence \
  -p "Update changelog.md for a new NPM release of compress-shader-literals.

New version: $NEW
Previous tag: $PREV_TAG

Commits since $PREV_TAG:
$COMMIT_LOG

Instructions:
- Read changelog.md first
- Add a new '## v$NEW' section at the very top (directly below the '# Changelog' heading)
- Only include meaningful changes: features, bug fixes, breaking changes, perf improvements
- Skip any commit that is only: chore, deploy, dist, demo, docs, README, backlog, format, prettier, gif, preview, CI internals
- Each bullet: concise, imperative tense, 1 line (e.g. 'Add: custom transform option')
- If zero meaningful commits exist, write '- Internal/infrastructure changes only'
- Do NOT modify any existing changelog entries" \
  --allowedTools "Read,Edit,Write" 2>&1

bun run format

# ── commit + tag + push (GHA workflow handles npm publish) ────────────────────
git add package.json bun.lock README.md changelog.md tests/bun.lock
git commit -m "chore: release $NEW"
git tag "$TAG"
git push origin HEAD
git push origin "$TAG"

echo ""
echo "✓ Tagged $TAG — GitHub Actions will publish to npm"
echo "  https://github.com/jayF0x/compress-shader-literals/actions"
