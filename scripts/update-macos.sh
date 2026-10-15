#!/usr/bin/env bash
# Update a local Apple Silicon Paseo desktop installation from this checkout.
set -euo pipefail

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$(uname -s)" == Darwin ]] || fail "This script only runs on macOS."
[[ "$(uname -m)" == arm64 ]] || fail "This script builds natively for Apple Silicon (arm64)."
for tool in git node npm ditto osascript pgrep open; do
  command -v "$tool" >/dev/null 2>&1 || fail "Missing required command: $tool"
done

[[ "$(git -C "$ROOT" branch --show-current)" == main ]] || fail "Checkout must be on main."
if [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]]; then
  fail "Tracked files have local changes. Commit or stash them before updating."
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || \
  fail "Node.js 22 or newer is required (current: $(node --version))."

if [[ -n "${PASEO_APP_PATH:-}" ]]; then
  APP_PATH="$PASEO_APP_PATH"
elif [[ -d /Applications/Paseo.app ]]; then
  APP_PATH=/Applications/Paseo.app
elif [[ -d "$HOME/Applications/Paseo.app" ]]; then
  APP_PATH="$HOME/Applications/Paseo.app"
else
  APP_PATH="$HOME/Applications/Paseo.app"
fi
[[ "$APP_PATH" == /*/Paseo.app ]] || fail "PASEO_APP_PATH must be an absolute path ending in /Paseo.app."
[[ ! -L "$APP_PATH" ]] || fail "Refusing to replace symlink: $APP_PATH"
APP_PARENT="$(dirname "$APP_PATH")"

log "Pulling origin/main"
git -C "$ROOT" pull --ff-only origin main
COMMIT="$(git -C "$ROOT" rev-parse --short=12 HEAD)"

log "Installing dependencies"
cd "$ROOT"
npm ci

log "Building Paseo for Apple Silicon ($COMMIT)"
PASEO_LOCAL_BUILD_COMMIT="$COMMIT" \
CSC_IDENTITY_AUTO_DISCOVERY=false \
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" \
npm run build:desktop -- \
  --publish never --mac --arm64 --dir \
  -c.mac.identity=- \
  -c.mac.notarize=false \
  -c.mac.hardenedRuntime=false

BUILT_APP="$ROOT/packages/desktop/release/mac-arm64/Paseo.app"
[[ -f "$BUILT_APP/Contents/Info.plist" && -x "$BUILT_APP/Contents/MacOS/Paseo" ]] || \
  fail "Built application missing or incomplete: $BUILT_APP"

# The build must succeed before touching the installed app.
if [[ ! -d "$APP_PARENT" ]]; then
  [[ "$APP_PARENT" == "$HOME/Applications" ]] || fail "Install directory does not exist: $APP_PARENT"
  mkdir -p "$APP_PARENT"
fi

if [[ -w "$APP_PARENT" ]]; then
  install_command() { "$@"; }
else
  log "Administrator authorization is needed to update $APP_PATH"
  sudo -v
  install_command() { sudo "$@"; }
fi

STAGED_APP="$APP_PARENT/.Paseo-update-$$.app"
BACKUP_APP="$APP_PARENT/.Paseo-backup-$$.app"
[[ ! -e "$STAGED_APP" && ! -e "$BACKUP_APP" ]] || fail "Temporary install path already exists."

# Prepare a complete copy beside the destination before replacing anything.
# Once installation begins, any failure must leave the previous app intact.
HAVE_BACKUP=false
update_cleanup() {
  status=$?
  trap - EXIT
  if (( status != 0 )) && [[ "$HAVE_BACKUP" == true ]]; then
    printf 'Restoring previous Paseo installation...\n' >&2
    install_command rm -rf "$APP_PATH" || true
    install_command mv "$BACKUP_APP" "$APP_PATH" || \
      printf 'Recovery failed. Previous app is still at: %s\n' "$BACKUP_APP" >&2
  fi
  if [[ -e "$STAGED_APP" ]]; then
    install_command rm -rf "$STAGED_APP" || true
  fi
  exit "$status"
}
trap update_cleanup EXIT

log "Staging new application"
install_command ditto "$BUILT_APP" "$STAGED_APP"

if pgrep -x Paseo >/dev/null 2>&1; then
  log "Asking the running Paseo application to quit"
  osascript -e 'tell application id "sh.paseo.desktop" to quit' >/dev/null || \
    fail "Could not ask Paseo to quit. Quit it manually and rerun the script."
  for ((i=0; i<30; i++)); do
    if ! pgrep -x Paseo >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if pgrep -x Paseo >/dev/null 2>&1; then
    fail "Paseo is still running. Quit it completely and rerun the script."
  fi
fi

log "Installing to $APP_PATH"
if [[ -e "$APP_PATH" ]]; then
  install_command mv "$APP_PATH" "$BACKUP_APP"
  HAVE_BACKUP=true
fi
install_command mv "$STAGED_APP" "$APP_PATH"
open "$APP_PATH"
trap - EXIT
if [[ "$HAVE_BACKUP" == true ]]; then
  install_command rm -rf "$BACKUP_APP" || printf 'Warning: old bundle remains at %s\n' "$BACKUP_APP" >&2
fi
log "Paseo updated to $COMMIT"
