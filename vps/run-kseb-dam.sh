#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_FILE="/tmp/kerala-dam-kseb.lock"

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 20 >/dev/null
fi

cd "$REPO_DIR"
GIT_PAGER=cat git pull --ff-only origin main
npm ci

# KSEB is geo-blocked outside India. Irrigation remains on the GitHub workflow.
node -e "require('./dam_details_fetcher').fetchKsebDamDetails().catch(error => { console.error(error); process.exit(1); })"

git add live.json historic_data
if git diff --cached --quiet; then
  exit 0
fi

git commit -m "Update KSEB dam details"
git push origin main
