#!/usr/bin/env bash
# Stop hook: no finishing while typecheck or unit tests fail. Gives up after 3 tries so it can't loop.
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -f package.json ] && [ -d node_modules ] || exit 0
COUNT_FILE=".claude/.stop-gate-count"
count=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)
checks="npx vitest run --passWithNoTests"
[ -f tsconfig.json ] && checks="npx tsc --noEmit && $checks"
if out=$(bash -c "$checks" 2>&1); then rm -f "$COUNT_FILE"; exit 0; fi
if [ "$count" -ge 3 ]; then rm -f "$COUNT_FILE"; exit 0; fi
echo $((count + 1)) > "$COUNT_FILE"
echo "Typecheck or tests are failing. Fix them before finishing, or after 3 tries write the problem in DECISIONS.md:" >&2
echo "$out" | tail -40 >&2
exit 2
