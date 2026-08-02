#!/usr/bin/env bash
# Re-copy the hand-picked upstream rules into config/opengrep/rules/.
# Needs a local checkout of https://github.com/semgrep/semgrep-rules.
set -euo pipefail

echo "TODO: FIX ME, THEN REMOVE THIS ECHO"
exit 1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DST="$SCRIPT_DIR/rules"

SEMGREP_RULES_REPO="${SEMGREP_RULES_REPO:-$HOME/Documents/GitHub/semgrep-rules}"
REACT_DIR="$SEMGREP_RULES_REPO/typescript/react"

if [ ! -d "$REACT_DIR" ]; then
  echo "[sync-rules] $REACT_DIR not found — set SEMGREP_RULES_REPO to your semgrep-rules checkout" >&2
  exit 1
fi

# Keep this list in sync with config/opengrep/rules/README.md if you add/drop a rule.
FILES=(
  "security/audit/react-dangerouslysetinnerhtml.yaml"
  "security/audit/react-unsanitized-method.yaml"
  "security/audit/react-unsanitized-property.yaml"
  "security/audit/react-href-var.yaml"
)

for f in "${FILES[@]}"; do
  cp "$REACT_DIR/$f" "$DST/$(basename "$f")"
  echo "[sync-rules] updated $(basename "$f")"
done
