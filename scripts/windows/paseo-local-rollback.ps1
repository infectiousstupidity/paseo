$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. "$PSScriptRoot\paseo-local-common.ps1"

$runtimeRoot = Get-PaseoLocalRuntimeRoot
$currentDir = Get-PaseoLocalCurrentDirectory
$previousDir = Get-PaseoLocalPreviousDirectory
$tempDir = Join-Path $runtimeRoot "rollback-temp"
$verifyScript = Join-Path $PSScriptRoot "verify-paseo-local-build.mjs"
$shortcutsScript = Join-Path $PSScriptRoot "install-paseo-shortcuts.ps1"

try {
    if (-not (Test-Path $previousDir)) {
        throw "No previous Paseo Local runtime is available yet."
    }

    Write-Host "Rolling Paseo Local back to the previous verified runtime..."
    Stop-PaseoLocal

    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    if (Test-Path $currentDir) {
        Move-Item -Path $currentDir -Destination $tempDir
    }
    Move-Item -Path $previousDir -Destination $currentDir
    if (Test-Path $tempDir) {
        Move-Item -Path $tempDir -Destination $previousDir
    }

    $currentAsar = Join-Path $currentDir "resources\app.asar"
    & node $verifyScript $currentAsar
    if ($LASTEXITCODE -ne 0) {
        throw "The rollback runtime did not pass Paseo Local verification."
    }

    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $shortcutsScript
    if ($LASTEXITCODE -ne 0) {
        throw "Shortcut refresh failed with exit code $LASTEXITCODE."
    }

    $desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "Paseo Local.lnk"
    if (-not (Test-Path $desktopShortcut)) {
        throw "Paseo Local shortcut was not created: $desktopShortcut"
    }
    Start-Process -FilePath $desktopShortcut | Out-Null
    Write-Host "Rollback complete."
    Read-Host "Press Enter to close"
} catch {
    Write-Host ""
    Write-Error $_
    Read-Host "Press Enter to close"
    exit 1
}
