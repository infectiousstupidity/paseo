$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = (Resolve-Path "$ScriptDir\..").Path
$AppDir = (Resolve-Path "$DesktopDir\..\app").Path
$RootDir = (Resolve-Path "$DesktopDir\..\..").Path
$env:PATH = "$RootDir\node_modules\.bin;$env:PATH"

# Build the Electron main process
npm run build:main

# Prefer Metro's stable default port so dev browser storage keeps the same
# localhost origin across restarts. Fall back only when earlier ports are busy.
$PreviousNoColor = $env:NO_COLOR
$PreviousForceColor = $env:FORCE_COLOR
try {
    $env:NO_COLOR = "1"
    $env:FORCE_COLOR = "0"
    $env:EXPO_PORT = (npx get-port-cli 8081 8082 8083 8084 8085).Trim()
} finally {
    if ($null -eq $PreviousNoColor) {
        Remove-Item Env:\NO_COLOR -ErrorAction SilentlyContinue
    } else {
        $env:NO_COLOR = $PreviousNoColor
    }
    if ($null -eq $PreviousForceColor) {
        Remove-Item Env:\FORCE_COLOR -ErrorAction SilentlyContinue
    } else {
        $env:FORCE_COLOR = $PreviousForceColor
    }
}

# Set EXPO_DEV_URL in the environment so Electron inherits it
$env:EXPO_DEV_URL = "http://localhost:$($env:EXPO_PORT)"
$env:EXPO_PUBLIC_PASEO_DEV_BUILD_LABEL = (git -C $RootDir branch --show-current).Trim()

$env:PASEO_DEV_ROOT = $RootDir
$env:PASEO_DEV_RUNTIME_FALLBACK_ROOT = $RootDir
$DevRuntime = node "$ScriptDir\dev-runtime.mjs" | ConvertFrom-Json
$env:PASEO_ELECTRON_FLAGS = $DevRuntime.electronFlags
$env:PASEO_ELECTRON_USER_DATA_DIR = $DevRuntime.userDataDir
Remove-Item Env:\PASEO_DEV_RUNTIME_FALLBACK_ROOT -ErrorAction SilentlyContinue

# Allow any origin in dev so Electron on random ports works.
# SECURITY: wildcard CORS is unsafe in production — only acceptable here because
# the daemon binds to localhost and this script is never used for production.
$env:PASEO_CORS_ORIGINS = "*"

# Fully isolate the dev instance from a production Paseo install so `npm run dev`
# works while the installed app is open. PASEO_HOME and PASEO_LISTEN are commonly
# set globally for a user's real daemon, so never inherit them here: doing so can
# make the dev desktop silently attach to production while claiming to be isolated.
# Use the dev-specific variables below when an override is intentionally wanted.
$DevStateDir = "$DesktopDir\.dev"
$InheritedPaseoHome = $env:PASEO_HOME
$InheritedPaseoListen = $env:PASEO_LISTEN
$env:PASEO_HOME = if ($env:PASEO_DEV_HOME) { $env:PASEO_DEV_HOME } else { "$DevStateDir\paseo-home" }

$DevDaemonPort = if ($env:PASEO_DEV_DAEMON_PORT) { $env:PASEO_DEV_DAEMON_PORT } else { "6788" }
$env:PASEO_LISTEN = "127.0.0.1:$DevDaemonPort"

if ($InheritedPaseoHome -and -not $env:PASEO_DEV_HOME) {
    Write-Host "  Ignoring inherited PASEO_HOME=$InheritedPaseoHome for dev isolation."
    Write-Host "  Set PASEO_DEV_HOME explicitly if you want a different dev home."
}
if ($InheritedPaseoListen) {
    Write-Host "  Ignoring inherited PASEO_LISTEN=$InheritedPaseoListen for dev isolation."
}

New-Item -ItemType Directory -Force -Path $env:PASEO_HOME, $env:PASEO_ELECTRON_USER_DATA_DIR | Out-Null

# Seed the isolated daemon config. The desktop daemon-manager decides whether a
# daemon is already running by reading `daemon.listen` from this config.json
# (it does NOT honor the PASEO_LISTEN env var) and probing that address. Without
# this it reads the default 6767, finds a production daemon there, and connects
# the dev app to prod — whose CORS allowlist then rejects the Metro origin. Pin
# the dev port + wildcard CORS in the file so the dev app starts its OWN daemon.
# Seed the dev home config. PASEO_HOME above is always dev-owned, including an
# explicit PASEO_DEV_HOME override, so this never rewrites the production home.
$env:TMP_CFG_PATH = "$($env:PASEO_HOME)/config.json"
$env:TMP_CFG_PORT = $DevDaemonPort
$TmpScript = [System.IO.Path]::GetTempFileName() + ".js"
$ScriptContent = @"
const fs = require('fs');
const path = process.env.TMP_CFG_PATH;
const port = process.env.TMP_CFG_PORT;
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path, 'utf8')); } catch(e) {}
cfg.version = cfg.version || 1;
cfg.daemon = cfg.daemon || {};
cfg.daemon.listen = '127.0.0.1:' + port;
cfg.daemon.cors = cfg.daemon.cors || {};
cfg.daemon.cors.allowedOrigins = ['*'];
fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
"@
Set-Content -Path $TmpScript -Value $ScriptContent
node $TmpScript
Remove-Item $TmpScript -ErrorAction SilentlyContinue
Remove-Item Env:\TMP_CFG_PATH -ErrorAction SilentlyContinue
Remove-Item Env:\TMP_CFG_PORT -ErrorAction SilentlyContinue

Write-Host @"
======================================================
  Paseo Desktop Dev (Windows)
======================================================
  Metro:      http://localhost:$($env:EXPO_PORT)
  Daemon:     $($env:PASEO_LISTEN) (isolated)
  PASEO_HOME: $($env:PASEO_HOME)
  userData:   $($env:PASEO_ELECTRON_USER_DATA_DIR)
======================================================
"@

# Launch Metro + Electron together, kill both on exit
concurrently `
    --kill-others `
    --names "metro,electron" `
    --prefix-colors "magenta,cyan" `
    "cd `"$AppDir`" && cross-env PASEO_WEB_PLATFORM=electron npx expo start --port $($env:EXPO_PORT)" `
    "npx wait-on tcp:$($env:EXPO_PORT) && npx electron `"$DesktopDir`""
