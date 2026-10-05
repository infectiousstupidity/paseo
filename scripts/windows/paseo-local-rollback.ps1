$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. "$PSScriptRoot\paseo-local-common.ps1"

$repoRoot = Get-PaseoRepoRoot
$buildRoot = Join-Path $repoRoot "packages\desktop\.local-build"
$currentInstaller = Join-Path $buildRoot "current-installer.exe"
$previousInstaller = Join-Path $buildRoot "previous-installer.exe"
$tempInstaller = Join-Path $buildRoot "rollback-swap.exe"

try {
    if (-not (Test-Path $previousInstaller)) {
        throw "No previous Paseo Local installer is available yet."
    }

    Write-Host "Rolling Paseo Local back to the previous successful installer..."
    Stop-PaseoLocal
    Install-PaseoLocalInstaller -InstallerPath $previousInstaller

    if (Test-Path $currentInstaller) {
        Copy-Item -Force $currentInstaller $tempInstaller
    }
    Copy-Item -Force $previousInstaller $currentInstaller
    if (Test-Path $tempInstaller) {
        Copy-Item -Force $tempInstaller $previousInstaller
        Remove-Item -Force $tempInstaller
    }

    Start-PaseoLocal
    Write-Host "Rollback complete."
    Start-Sleep -Seconds 2
} catch {
    Write-Host ""
    Write-Error $_
    Read-Host "Press Enter to close"
    exit 1
}
