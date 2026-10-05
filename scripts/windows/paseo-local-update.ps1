$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. "$PSScriptRoot\paseo-local-common.ps1"

$repoRoot = Get-PaseoRepoRoot
$desktopDir = Join-Path $repoRoot "packages\desktop"
$buildRoot = Join-Path $desktopDir ".local-build"
$releaseDir = Join-Path $buildRoot "release"
$currentInstaller = Join-Path $buildRoot "current-installer.exe"
$previousInstaller = Join-Path $buildRoot "previous-installer.exe"
$verifyScript = Join-Path $PSScriptRoot "verify-paseo-local-build.mjs"
$localStopped = $false

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

    $previousLocalBuildCommit = $env:PASEO_LOCAL_BUILD_COMMIT
    $env:PASEO_LOCAL_BUILD_COMMIT = $buildCommit
    Push-Location $repoRoot
    try {
        & npm run build:desktop -- --win nsis --x64 --publish never "-c.directories.output=.local-build/release"
        if ($LASTEXITCODE -ne 0) {
            throw "Paseo Local build failed with exit code $LASTEXITCODE. The installed app was not touched."
        }
    } finally {
        Pop-Location
        if ($null -eq $previousLocalBuildCommit) {
            Remove-Item Env:\PASEO_LOCAL_BUILD_COMMIT -ErrorAction SilentlyContinue
        } else {
            $env:PASEO_LOCAL_BUILD_COMMIT = $previousLocalBuildCommit
        }
    }

    $installer = Get-ChildItem -Path $releaseDir -Filter "Paseo-Setup-*-x64.exe" -File -Recurse |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $installer) {
        throw "Build completed but no x64 NSIS installer was found in $releaseDir."
    }

    $packagedAsar = Join-Path $releaseDir "win-unpacked\resources\app.asar"
    if (-not (Test-Path $packagedAsar)) {
        throw "Build completed but the packaged app.asar was not found: $packagedAsar"
    }

    Write-Host "Verifying the packaged fork before touching the installed Paseo..."
    & node $verifyScript $packagedAsar $buildCommit
    if ($LASTEXITCODE -ne 0) {
        throw "The newly built package is not a verified Paseo Local build. The installed app was not touched."
    }

    Write-Host ""
    Write-Host "Build verified. Replacing the installed Paseo..."
    Stop-PaseoLocal
    $localStopped = $true
    Install-PaseoLocalInstaller -InstallerPath $installer.FullName

    $installedAsar = Join-Path (Split-Path -Parent (Get-PaseoInstalledExecutable)) "resources\app.asar"
    Write-Host "Verifying the installed fork..."
    & node $verifyScript $installedAsar $buildCommit
    if ($LASTEXITCODE -ne 0) {
        throw "Installation completed, but the installed app is not the expected Paseo Local build."
    }

    if (Test-Path $currentInstaller) {
        Copy-Item -Force $currentInstaller $previousInstaller
    }
    Copy-Item -Force $installer.FullName $currentInstaller

    Start-PaseoLocal
    $localStopped = $false

    Write-Host ""
    Write-Host "Paseo Local updated and verified successfully."
    Write-Host "Running build: $buildCommit"
    Write-Host "The Paseo window title should now show: Paseo Local · <version> · $buildCommit"
    Write-Host ""
    Read-Host "Press Enter to close"
} catch {
    Write-Host ""
    Write-Error $_
    if ($localStopped -and (Test-Path (Get-PaseoInstalledExecutable))) {
        Write-Host "Restarting the currently installed Paseo so you are not left without a working app."
        Start-PaseoLocal
    }
    Write-Host ""
    Write-Host "No success was recorded. The terminal is staying open so the failure is visible."
    Read-Host "Press Enter to close"
    exit 1
}
