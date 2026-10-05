$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. "$PSScriptRoot\paseo-local-common.ps1"

$repoRoot = Get-PaseoRepoRoot
$desktopDir = Join-Path $repoRoot "packages\desktop"
$buildRoot = Join-Path $desktopDir ".local-build"
$releaseDir = Join-Path $buildRoot "release"
$currentInstaller = Join-Path $buildRoot "current-installer.exe"
$previousInstaller = Join-Path $buildRoot "previous-installer.exe"

try {
    New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
    Remove-Item -Recurse -Force $releaseDir -ErrorAction SilentlyContinue

    $buildCommit = (& git -C $repoRoot rev-parse --short=12 HEAD).Trim()
    if (-not $buildCommit) {
        throw "Could not determine the current Git commit."
    }
    $dirty = (& git -C $repoRoot status --porcelain --untracked-files=no)
    if ($dirty) {
        $buildCommit = "$buildCommit-dirty"
    }

    Write-Host "Building Paseo Local from commit $buildCommit..."
    Write-Host "Your installed Paseo remains running until this build succeeds."
    Write-Host ""

    Push-Location $repoRoot
    try {
        & npm run build:desktop -- --win nsis --x64 --publish never "-c.directories.output=.local-build/release" "-c.extraMetadata.paseoBuildFlavor=local" "-c.extraMetadata.paseoBuildCommit=$buildCommit"
        if ($LASTEXITCODE -ne 0) {
            throw "Paseo Local build failed with exit code $LASTEXITCODE. The installed app was not touched."
        }
    } finally {
        Pop-Location
    }

    $installer = Get-ChildItem -Path $releaseDir -Filter "Paseo-Setup-*-x64.exe" -File -Recurse |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $installer) {
        throw "Build completed but no x64 NSIS installer was found in $releaseDir."
    }

    Write-Host ""
    Write-Host "Build succeeded. Replacing the installed Paseo..."
    Stop-PaseoLocal
    Install-PaseoLocalInstaller -InstallerPath $installer.FullName

    if (Test-Path $currentInstaller) {
        Copy-Item -Force $currentInstaller $previousInstaller
    }
    Copy-Item -Force $installer.FullName $currentInstaller

    Start-PaseoLocal

    Write-Host ""
    Write-Host "Paseo Local updated successfully."
    Write-Host "Running build: $buildCommit"
    Write-Host "The Paseo window title should now show: Paseo Local · <version> · $buildCommit"
    Write-Host ""
    Read-Host "Press Enter to close"
} catch {
    Write-Host ""
    Write-Error $_
    Write-Host "The workflow stopped. If an older local build was already replaced, use Rollback Paseo Local from the Start menu."
    Read-Host "Press Enter to close"
    exit 1
}
