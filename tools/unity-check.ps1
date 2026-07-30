# Runs the Unity import check in batchmode and prints the JSON report.
#   powershell -ExecutionPolicy Bypass -File tools\unity-check.ps1
# Requires an activated Unity Editor license (sign in via Unity Hub first).
#
# NOTE: kept ASCII-only on purpose. Windows PowerShell 5.1 reads .ps1 files as
# ANSI unless they carry a UTF-8 BOM, which mangles non-ASCII source.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$proj = Join-Path $repo 'unity'

$verFile = Join-Path $proj 'ProjectSettings\ProjectVersion.txt'
$ver = ((Get-Content $verFile | Select-String '^m_EditorVersion:') -split ':\s*')[1].Trim()
$unity = "C:\Program Files\Unity\Hub\Editor\$ver\Editor\Unity.exe"

if (-not (Test-Path $unity)) { throw "Unity $ver not found at $unity" }

$log = Join-Path $env:TEMP 'unity-check.log'
Write-Host "Running Unity $ver in batchmode (first run resolves packages, may take minutes)..."

$sw = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath $unity -ArgumentList @(
    '-batchmode', '-quit',
    '-projectPath', $proj,
    '-executeMethod', 'ImportCheck.Run',
    '-logFile', $log
) -Wait -PassThru -NoNewWindow
$sw.Stop()

Write-Host ("exit={0}  elapsed={1:N0}s" -f $p.ExitCode, $sw.Elapsed.TotalSeconds)

if ($p.ExitCode -eq 198) {
    Write-Host "LICENSE NOT ACTIVE. Open Unity Hub, sign in, then re-run." -ForegroundColor Yellow
    Get-Content $log | Select-String -Pattern 'license|Licensing' | Select-Object -Last 5
    exit 198
}

$text = Get-Content $log -Raw
$s = $text.IndexOf('UNITY_JSON_BEGIN')
$e = $text.IndexOf('UNITY_JSON_END')
if ($s -ge 0 -and $e -gt $s) {
    $text.Substring($s + 16, $e - $s - 16).Trim()
} else {
    Write-Host "No JSON block found. Last 40 log lines:" -ForegroundColor Yellow
    Get-Content $log -Tail 40
}
