$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. "$PSScriptRoot\paseo-local-common.ps1"

$repoRoot = Get-PaseoRepoRoot
$buildRoot = Get-PaseoLocalBuildRoot
$stagingRoot = Join-Path $buildRoot "staging"
$stagedApp = Join-Path $stagingRoot "win-unpacked"
$runtimeRoot = Get-PaseoLocalRuntimeRoot
$incomingDir = Join-Path $runtimeRoot "incoming"
$currentDir = Get-PaseoLocalCurrentDirectory
$previousDir = Get-PaseoLocalPreviousDirectory
$failedDir = Join-Path $runtimeRoot "failed"
$verifyScript = Join-Path $PSScriptRoot "verify-paseo-local-build.mjs"
$shortcutsScript = Join-Path $PSScriptRoot "install-paseo-shortcuts.ps1"
$swapped = $false

$logRoot = Join-Path $env:LOCALAPPDATA "PaseoLocal\logs"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$logPath = Join-Path $logRoot ("update-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
$transcriptStarted = $false
try {
    Start-Transcript -Path $logPath -Force | Out-Null
    $transcriptStarted = $true
} catch {
    Write-Warning "Could not start transcript: $($_.Exception.Message)"
}

Write-Host "PASEO LOCAL UPDATE LOG"
Write-Host "Log:         $logPath"
Write-Host "Script:      $PSCommandPath"
Write-Host "Repo:        $repoRoot"
Write-Host "Runtime:     $runtimeRoot"
Write-Host "PowerShell:  $($PSVersionTable.PSVersion)"
Write-Host "Node:        $(& node --version)"
Write-Host ""

function Assert-LastExitCode {
    param([Parameter(Mandatory = $true)][string]$Step)
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

function Restore-PreviousRuntime {
    if (-not $swapped) {
        return
    }

    Stop-PaseoLocal

    Remove-Item -Recurse -Force $failedDir -ErrorAction SilentlyContinue
    if (Test-Path $currentDir) {
        Move-Item -Path $currentDir -Destination $failedDir
    }
    if (Test-Path $previousDir) {
        Move-Item -Path $previousDir -Destination $currentDir
    }

    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $shortcutsScript | Out-Null

    if (Test-Path (Get-PaseoLocalCurrentExecutable)) {
        Start-PaseoLocal | Out-Null
    } elseif (Test-Path (Get-PaseoInstalledExecutable)) {
        Start-Process -FilePath (Get-PaseoInstalledExecutable) | Out-Null
    }
}

try {
    New-Item -ItemType Directory -Force -Path $buildRoot, $runtimeRoot | Out-Null
    Remove-Item -Recurse -Force $stagingRoot -ErrorAction SilentlyContinue

    # Clean up artifacts from the abandoned NSIS-based local workflow.
    Remove-Item -Recurse -Force (Join-Path $buildRoot "release") -ErrorAction SilentlyContinue
    Remove-Item -Force (Join-Path $buildRoot "current-installer.exe") -ErrorAction SilentlyContinue
    Remove-Item -Force (Join-Path $buildRoot "previous-installer.exe") -ErrorAction SilentlyContinue

    $buildCommit = (& git -C $repoRoot rev-parse --short=12 HEAD).Trim()
    Assert-LastExitCode "Reading Git commit"
    if (-not $buildCommit) {
        throw "Could not determine the current Git commit."
    }

    $dirty = (& git -C $repoRoot status --porcelain --untracked-files=no)
    Assert-LastExitCode "Reading Git status"
    if ($dirty) {
        $buildCommit = "$buildCommit-dirty"
    }

    Write-Host "Building a packaged Paseo Local runtime from $buildCommit..."
    Write-Host "The currently running Paseo is not touched during the build."
    Write-Host ""

    $previousLocalBuildCommit = $env:PASEO_LOCAL_BUILD_COMMIT
    $env:PASEO_LOCAL_BUILD_COMMIT = $buildCommit
    Push-Location $repoRoot
    try {
        # --dir produces the real packaged Windows application without putting
        # it through NSIS. This keeps production Electron/ASAR/daemon behavior
        # while avoiding same-version installer replacement entirely.
        & npm run build:desktop -- --dir --win --x64 "-c.directories.output=.local-build/staging"
        Assert-LastExitCode "Paseo Local build"
    } finally {
        Pop-Location
        if ($null -eq $previousLocalBuildCommit) {
            Remove-Item Env:\PASEO_LOCAL_BUILD_COMMIT -ErrorAction SilentlyContinue
        } else {
            $env:PASEO_LOCAL_BUILD_COMMIT = $previousLocalBuildCommit
        }
    }

    $stagedAsar = Join-Path $stagedApp "resources\app.asar"
    if (-not (Test-Path $stagedAsar)) {
        throw "Packaged app.asar was not produced: $stagedAsar"
    }

    Write-Host "Verifying staged production build..."
    & node $verifyScript $stagedAsar $buildCommit
    Assert-LastExitCode "Staged build verification"

    if (-not (Test-Path (Join-Path $stagedApp "Paseo.exe"))) {
        throw "Packaged Paseo.exe was not produced in $stagedApp"
    }

    Write-Host "Copying the verified build into the local runtime area..."
    Remove-Item -Recurse -Force $incomingDir -ErrorAction SilentlyContinue
    Copy-Item -Path $stagedApp -Destination $incomingDir -Recurse

    $incomingAsar = Join-Path $incomingDir "resources\app.asar"
    & node $verifyScript $incomingAsar $buildCommit
    Assert-LastExitCode "Incoming runtime verification"

    Write-Host ""
    Write-Host "Build verified. Switching Paseo Local to the new runtime..."
    Stop-PaseoLocal

    Remove-Item -Recurse -Force $failedDir -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $previousDir -ErrorAction SilentlyContinue

    if (Test-Path $currentDir) {
        Move-Item -Path $currentDir -Destination $previousDir
    }

    Move-Item -Path $incomingDir -Destination $currentDir
    $swapped = $true

    $currentAsar = Join-Path $currentDir "resources\app.asar"
    & node $verifyScript $currentAsar $buildCommit
    Assert-LastExitCode "Activated build verification"

    # Recreate shortcuts after the swap so Paseo Local uses the current runtime
    # icon but continues to launch through the stable launcher script.
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $shortcutsScript
    Assert-LastExitCode "Shortcut refresh"

    $startedExe = Get-PaseoLocalCurrentExecutable
    $desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "Paseo Local.lnk"
    if (-not (Test-Path $desktopShortcut)) {
        throw "Paseo Local shortcut was not created: $desktopShortcut"
    }

    # Launch through the direct .lnk target so Explorer owns the GUI launch,
    # rather than leaving Paseo attached to this updater console.
    Start-Process -FilePath $desktopShortcut | Out-Null
    Start-Sleep -Seconds 2

    $running = @(Get-PaseoProcessesForExecutable -ExecutablePath $startedExe)
    if ($running.Count -eq 0) {
        throw "Paseo Local exited immediately after launch."
    }

    $swapped = $false
    Remove-Item -Recurse -Force $stagingRoot -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "Paseo Local updated and verified successfully."
    Write-Host "Runtime: $startedExe"
    Write-Host "Build:   $buildCommit"
    Write-Host "Window:  Paseo Local · <version> · $buildCommit"
    Write-Host "Log:     $logPath"
    Write-Host ""
    if ($transcriptStarted) {
        Stop-Transcript | Out-Null
        $transcriptStarted = $false
    }
    Read-Host "Press Enter to close"
} catch {
    $failure = $_
    Write-Host ""
    Write-Error $failure

    try {
        Restore-PreviousRuntime
        if ($swapped) {
            Write-Host "The previous Paseo Local runtime was restored."
        }
    } catch {
        Write-Warning "Automatic rollback also failed: $($_.Exception.Message)"
    }

    Write-Host ""
    Write-Host "No success was recorded. This window will stay open so the failure is visible."
    Write-Host "Log: $logPath"
    if ($transcriptStarted) {
        Stop-Transcript | Out-Null
        $transcriptStarted = $false
    }
    Read-Host "Press Enter to close"
    exit 1
}
