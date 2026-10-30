#!/usr/bin/env bash
# SessionStart hook: on a cloud restart, reinstall packages and the test browser if missing.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -f package.json ] || exit 0
[ -d node_modules ] || npm install --no-audit --no-fund >/dev/null 2>&1
npx playwright install chromium >/dev/null 2>&1 || echo "Playwright browser not available; use the fallback in SETUP FIRST step 3."
exit 0
