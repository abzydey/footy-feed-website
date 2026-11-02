#!/bin/bash
# Runs at the start of every Claude Code session (.claude/settings.json) and
# does nothing outside the cloud. Installs dependencies and generates the
# Prisma client, so apps/api scripts work straight away from a fresh clone.
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1
hashes=node_modules/.cloud-setup.sha256

if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  if npm install --no-audit --no-fund; then
    sha256sum scripts/cloud-setup.sh package.json package-lock.json apps/api/package.json apps/web/package.json > "$hashes" || rm -f "$hashes"
  fi
fi

(cd apps/api && npx prisma generate)
exit 0
