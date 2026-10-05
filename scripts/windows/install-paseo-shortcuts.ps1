$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. "$PSScriptRoot\paseo-local-common.ps1"

function New-PaseoShortcut {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Target,
        [string]$Arguments = "",
        [string]$WorkingDirectory = "",
        [string]$IconLocation = "",
        [string]$Description = ""
    )

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    $shortcut.TargetPath = $Target
    $shortcut.Arguments = $Arguments
    if ($WorkingDirectory) { $shortcut.WorkingDirectory = $WorkingDirectory }
    if ($IconLocation) { $shortcut.IconLocation = $IconLocation }
    if ($Description) { $shortcut.Description = $Description }
    $shortcut.Save()
}

try {
    $repoRoot = Get-PaseoRepoRoot
    $localExe = Get-PaseoLocalCurrentExecutable
    $installedExe = Get-PaseoInstalledExecutable
    $desktop = [Environment]::GetFolderPath("Desktop")
    $programs = [Environment]::GetFolderPath("Programs")
    $startMenuDir = Join-Path $programs "Paseo Local Tools"
    New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null

    $pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue
    if ($pwsh) {
        $powershellExe = $pwsh.Source
    } else {
        $powershellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    }

    $repoIcon = Join-Path $repoRoot "packages\desktop\assets\icon.ico"
    if (Test-Path $localExe) {
        $appIcon = $localExe
    } elseif (Test-Path $installedExe) {
        $appIcon = $installedExe
    } else {
        $appIcon = $repoIcon
    }

    $localScript = Join-Path $PSScriptRoot "paseo-local-launch.ps1"
    $devScript = Join-Path $PSScriptRoot "paseo-dev.ps1"
    $updateScript = Join-Path $PSScriptRoot "paseo-local-update.ps1"
    $rollbackScript = Join-Path $PSScriptRoot "paseo-local-rollback.ps1"

    $localArgs = '-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $localScript
    $devArgs = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $devScript
    $updateArgs = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $updateScript
    $rollbackArgs = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $rollbackScript

    $localParams = @{
        Path = Join-Path $desktop "Paseo Local.lnk"
        Target = $powershellExe
        Arguments = $localArgs
        WorkingDirectory = $repoRoot
        IconLocation = "$appIcon,0"
        Description = "Verified packaged Paseo fork daily driver"
    }
    New-PaseoShortcut @localParams

    $devParams = @{
        Path = Join-Path $desktop "Paseo Dev.lnk"
        Target = $powershellExe
        Arguments = $devArgs
        WorkingDirectory = $repoRoot
        IconLocation = "$repoIcon,0"
        Description = "Isolated Paseo development preview with hot reload"
    }
    New-PaseoShortcut @devParams

    $updateParams = @{
        Path = Join-Path $desktop "Update Paseo Local.lnk"
        Target = $powershellExe
        Arguments = $updateArgs
        WorkingDirectory = $repoRoot
        IconLocation = "$repoIcon,0"
        Description = "Build, verify, and switch Paseo Local to the current fork"
    }
    New-PaseoShortcut @updateParams

    $rollbackParams = @{
        Path = Join-Path $startMenuDir "Rollback Paseo Local.lnk"
        Target = $powershellExe
        Arguments = $rollbackArgs
        WorkingDirectory = $repoRoot
        IconLocation = "$repoIcon,0"
        Description = "Swap Paseo Local back to the previous verified runtime"
    }
    New-PaseoShortcut @rollbackParams

    Write-Host "Created desktop shortcuts:"
    Write-Host "  Paseo Local"
    Write-Host "  Paseo Dev"
    Write-Host "  Update Paseo Local"
    Write-Host ""
    Write-Host "Created Start menu tool:"
    Write-Host "  Paseo Local Tools\Rollback Paseo Local"
} catch {
    Write-Error $_
    exit 1
}
