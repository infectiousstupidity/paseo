$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:PaseoRepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path

function Get-PaseoRepoRoot {
    return $script:PaseoRepoRoot
}

function Get-PaseoInstalledExecutable {
    if ($env:PASEO_LOCAL_EXE) {
        return [System.IO.Path]::GetFullPath($env:PASEO_LOCAL_EXE)
    }
    return Join-Path $env:LOCALAPPDATA "Programs\Paseo\Paseo.exe"
}

function Get-PaseoProductionHome {
    if ($env:PASEO_HOME) {
        return [System.IO.Path]::GetFullPath($env:PASEO_HOME)
    }
    return Join-Path $HOME ".paseo"
}

function Get-PaseoInstalledProcesses {
    param([Parameter(Mandatory = $true)][string]$ExecutablePath)

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

function Stop-PaseoLocal {
    $repoRoot = Get-PaseoRepoRoot
    $installedExe = Get-PaseoInstalledExecutable
    $paseoHome = Get-PaseoProductionHome

    if (Test-Path $installedExe) {
        # Avoid running the currently installed upstream updater during replacement.
        # Kill only the GUI main process first; the daemon is handled separately.
        $guiProcesses = @(
            Get-PaseoInstalledProcesses -ExecutablePath $installedExe |
                Where-Object {
                    $commandLine = [string]$_.CommandLine
                    $commandLine -notmatch "--type=" -and
                    $commandLine -notmatch "node-entrypoint-runner" -and
                    $commandLine -notmatch "supervisor-entrypoint"
                }
        )
        foreach ($processInfo in $guiProcesses) {
            Stop-Process -Id $processInfo.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }

    Start-Sleep -Milliseconds 500

    # Stop the production daemon cleanly when possible. The explicit --home keeps
    # this away from the isolated Dev daemon.
    $devCli = Join-Path $repoRoot "packages\cli\src\index.ts"
    Push-Location $repoRoot
    try {
        try {
            & npx tsx $devCli daemon stop --home $paseoHome --json --force *> $null
        } catch {
            Write-Warning "Could not stop the Paseo daemon through the source CLI; remaining packaged processes will be stopped."
        }
    } finally {
        Pop-Location
    }

    if (Test-Path $installedExe) {
        Start-Sleep -Milliseconds 500
        foreach ($processInfo in (Get-PaseoInstalledProcesses -ExecutablePath $installedExe)) {
            Stop-Process -Id $processInfo.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Install-PaseoLocalInstaller {
    param([Parameter(Mandatory = $true)][string]$InstallerPath)

    if (-not (Test-Path $InstallerPath)) {
        throw "Paseo installer not found: $InstallerPath"
    }

    $installer = Start-Process -FilePath $InstallerPath -ArgumentList @("/S") -Wait -PassThru
    if ($installer.ExitCode -ne 0) {
        throw "Paseo installer exited with code $($installer.ExitCode)."
    }
}

function Start-PaseoLocal {
    $installedExe = Get-PaseoInstalledExecutable
    if (-not (Test-Path $installedExe)) {
        throw "Installed Paseo executable not found: $installedExe"
    }
    Start-Process -FilePath $installedExe | Out-Null
}
