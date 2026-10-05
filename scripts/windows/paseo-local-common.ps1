$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:PaseoRepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path

function Get-PaseoRepoRoot {
    return $script:PaseoRepoRoot
}

function Get-PaseoLocalBuildRoot {
    return Join-Path $script:PaseoRepoRoot "packages\desktop\.local-build"
}

function Get-PaseoLocalRuntimeRoot {
    return Join-Path (Get-PaseoLocalBuildRoot) "runtime"
}

function Get-PaseoLocalCurrentDirectory {
    return Join-Path (Get-PaseoLocalRuntimeRoot) "current"
}

function Get-PaseoLocalPreviousDirectory {
    return Join-Path (Get-PaseoLocalRuntimeRoot) "previous"
}

function Get-PaseoLocalCurrentExecutable {
    return Join-Path (Get-PaseoLocalCurrentDirectory) "Paseo.exe"
}

function Get-PaseoInstalledExecutable {
    return Join-Path $env:LOCALAPPDATA "Programs\Paseo\Paseo.exe"
}

function Get-PaseoProductionHome {
    if ($env:PASEO_HOME) {
        return [System.IO.Path]::GetFullPath($env:PASEO_HOME)
    }
    return Join-Path $HOME ".paseo"
}

function Get-PaseoProcessesForExecutable {
    param([Parameter(Mandatory = $true)][string]$ExecutablePath)

    if (-not (Test-Path $ExecutablePath)) {
        return @()
    }

    $target = [System.IO.Path]::GetFullPath($ExecutablePath)
    return @(
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.ExecutablePath -and
                ([string]$_.ExecutablePath).Equals(
                    $target,
                    [System.StringComparison]::OrdinalIgnoreCase
                )
            }
    )
}

function Stop-PaseoExecutableMainProcess {
    param([Parameter(Mandatory = $true)][string]$ExecutablePath)

    foreach ($processInfo in (Get-PaseoProcessesForExecutable -ExecutablePath $ExecutablePath)) {
        $commandLine = [string]$processInfo.CommandLine
        if (
            $commandLine -notmatch "--type=" -and
            $commandLine -notmatch "node-entrypoint-runner" -and
            $commandLine -notmatch "supervisor-entrypoint"
        ) {
            Stop-Process -Id $processInfo.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Stop-AllPaseoProcessesForExecutable {
    param([Parameter(Mandatory = $true)][string]$ExecutablePath)

    foreach ($processInfo in (Get-PaseoProcessesForExecutable -ExecutablePath $ExecutablePath)) {
        Stop-Process -Id $processInfo.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Stop-PaseoLocal {
    $repoRoot = Get-PaseoRepoRoot
    $paseoHome = Get-PaseoProductionHome
    $targets = @(
        (Get-PaseoLocalCurrentExecutable),
        (Join-Path (Get-PaseoLocalPreviousDirectory) "Paseo.exe"),
        (Get-PaseoInstalledExecutable)
    ) | Select-Object -Unique

    # Close GUI processes first. This lets the daemon-control command below stop
    # the real production daemon cleanly rather than killing it mid-write.
    foreach ($target in $targets) {
        Stop-PaseoExecutableMainProcess -ExecutablePath $target
    }

    Start-Sleep -Milliseconds 500

    $devCli = Join-Path $repoRoot "packages\cli\src\index.ts"
    Push-Location $repoRoot
    try {
        & npx tsx $devCli daemon stop --home $paseoHome --json --force *> $null
        # Native command failures do not reliably throw in Windows PowerShell.
        # A nonzero exit is acceptable here because we kill only known Paseo
        # executable paths below as a final cleanup.
    } finally {
        Pop-Location
    }

    Start-Sleep -Milliseconds 500
    foreach ($target in $targets) {
        Stop-AllPaseoProcessesForExecutable -ExecutablePath $target
    }
}

function Start-PaseoLocal {
    $localExe = Get-PaseoLocalCurrentExecutable
    if (Test-Path $localExe) {
        Start-Process -FilePath $localExe | Out-Null
        return $localExe
    }

    # Before the first successful local build, keep the shortcut useful by
    # falling back to the normal installed Paseo.
    $installedExe = Get-PaseoInstalledExecutable
    if (Test-Path $installedExe) {
        Start-Process -FilePath $installedExe | Out-Null
        return $installedExe
    }

    throw "Neither Paseo Local nor the normal installed Paseo was found."
}
