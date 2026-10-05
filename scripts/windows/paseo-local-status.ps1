$ErrorActionPreference = "Continue"
Set-StrictMode -Version Latest

. "$PSScriptRoot\paseo-local-common.ps1"

function Read-Shortcut {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path $Path)) {
        return [pscustomobject]@{ Path = $Path; Exists = $false; Target = $null; Arguments = $null }
    }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    return [pscustomobject]@{
        Path = $Path
        Exists = $true
        Target = $shortcut.TargetPath
        Arguments = $shortcut.Arguments
    }
}

$repoRoot = Get-PaseoRepoRoot
$runtimeRoot = Get-PaseoLocalRuntimeRoot
$currentExe = Get-PaseoLocalCurrentExecutable
$currentAsar = Join-Path (Get-PaseoLocalCurrentDirectory) "resources\app.asar"
$stagingAsar = Join-Path (Get-PaseoLocalBuildRoot) "staging\win-unpacked\resources\app.asar"
$verifyScript = Join-Path $PSScriptRoot "verify-paseo-local-build.mjs"
$desktop = [Environment]::GetFolderPath("Desktop")
$logRoot = Join-Path $env:LOCALAPPDATA "PaseoLocal\logs"

Write-Host "=== Paseo Local status ==="
Write-Host "Repo: $repoRoot"
Write-Host "HEAD: $(& git -C $repoRoot rev-parse HEAD 2>$null)"
Write-Host "Dirty:"
& git -C $repoRoot status --short
Write-Host ""

Write-Host "Shortcuts:"
Read-Shortcut (Join-Path $desktop "Paseo Local.lnk") | Format-List
Read-Shortcut (Join-Path $desktop "Update Paseo Local.lnk") | Format-List

Write-Host "Paths:"
Write-Host "  Runtime root: $runtimeRoot"
Write-Host "  Current exe exists: $(Test-Path $currentExe)"
Write-Host "  Current asar exists: $(Test-Path $currentAsar)"
Write-Host "  Staging asar exists: $(Test-Path $stagingAsar)"
Write-Host ""

if (Test-Path $currentAsar) {
    Write-Host "Current runtime marker:"
    & node $verifyScript $currentAsar
    Write-Host ""
}
if (Test-Path $stagingAsar) {
    Write-Host "Staging marker:"
    & node $verifyScript $stagingAsar
    Write-Host ""
}

Write-Host "Running Paseo executables:"
Get-CimInstance Win32_Process -Filter "Name='Paseo.exe'" -ErrorAction SilentlyContinue |
    Select-Object ProcessId, ExecutablePath, CommandLine |
    Format-Table -AutoSize

Write-Host ""
Write-Host "Latest update log:"
$latestLog = Get-ChildItem $logRoot -Filter "update-*.log" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($latestLog) {
    Write-Host $latestLog.FullName
    Write-Host "---- last 80 lines ----"
    Get-Content $latestLog.FullName -Tail 80
} else {
    Write-Host "<none>"
}
