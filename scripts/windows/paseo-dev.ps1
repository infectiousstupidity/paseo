$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$desktopDevRoot = Join-Path $repoRoot "packages\desktop\.dev"

# This profile is separate from both production Paseo and the benchmark profile.
# Do not add the Paseo source repo itself as a workspace here; Metro already
# watches the source tree for renderer hot reload.
$env:PASEO_TEST_APP_NAME = "Paseo Dev"
$env:PASEO_DEV_HOME = Join-Path $desktopDevRoot "self-host-paseo-home"
$env:PASEO_DEV_USER_DATA_DIR = Join-Path $desktopDevRoot "self-host-user-data"

Push-Location $repoRoot
try {
    & npm run dev:win:desktop
    if ($LASTEXITCODE -ne 0) {
        throw "Paseo Dev exited with code $LASTEXITCODE."
    }
} catch {
    Write-Host ""
    Write-Error $_
    Read-Host "Press Enter to close"
    exit 1
} finally {
    Pop-Location
}
