# Start hidden with Start-Process powershell -WindowStyle Hidden -File tools/work-watch.ps1.
# Stops on real failures. Exit 75 upgrades the immutable process checkout between workers.
$ErrorActionPreference = 'Stop'
$repoDirectory = Split-Path $PSScriptRoot -Parent
$gitBash = Join-Path $env:ProgramFiles 'Git/bin/bash.exe'
do {
    & $gitBash (Join-Path $PSScriptRoot 'work.sh') --watch
    $workerExit = $LASTEXITCODE
} while ($workerExit -eq 75)
exit $workerExit
