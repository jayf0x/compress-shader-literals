#!/usr/bin/env bash
# Run opengrep security scan against src/.
# Called by CI; can also be run locally.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Configuration ──────────────────────────────────────────────────────────────
RULES_DIR="$REPO_ROOT/config/opengrep/rules"
SCAN_TARGETS=("$REPO_ROOT/src")
# ──────────────────────────────────────────────────────────────────────────────

if ! command -v opengrep &>/dev/null; then
  echo "[opengrep-scan] opengrep not found — installing..."
  curl -fsSL https://raw.githubusercontent.com/opengrep/opengrep/main/install.sh | bash
  # installer puts the binary at ~/.local/bin/opengrep or ~/.opengrep/cli/latest/opengrep
  export PATH="$HOME/.local/bin:$HOME/.opengrep/cli/latest:$PATH"
fi

echo "[opengrep-scan] scanning ${SCAN_TARGETS[*]}"
echo "[opengrep-scan] rules: $RULES_DIR"
echo ""

opengrep scan \
  --config "$RULES_DIR" \
  --error \
  --no-git-ignore \
  "${SCAN_TARGETS[@]}"
