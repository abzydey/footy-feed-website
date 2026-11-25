#!/bin/bash
# Runs at the start of every Claude Code session (.claude/settings.json) and
# Installs dependencies and generates the Prisma client in the cloud, so
# apps/api scripts work straight away from a fresh clone. On the laptop it only
# pulls main, since cloud sessions push there too.
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  cd "$CLAUDE_PROJECT_DIR" 2>/dev/null && [ "$(git branch --show-current)" = main ] &&
    git pull --rebase --autostash -q >/dev/null 2>&1
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1
hashes=node_modules/.cloud-setup.sha256

if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  if npm ci --no-audit --no-fund; then
    sha256sum scripts/cloud-setup.sh package.json package-lock.json apps/api/package.json apps/web/package.json > "$hashes" || rm -f "$hashes"
  fi
fi

(cd apps/api && npx prisma generate)
exit 0
