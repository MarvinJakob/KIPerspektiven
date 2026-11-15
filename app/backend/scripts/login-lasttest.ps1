<#
.SYNOPSIS
Lasttest der Anmeldung (Ticket #138) gegen einen lokalen Server mit einem Prozessorkern.

.DESCRIPTION
Startet je Stufe einen frischen Server als eigenen Prozess: GOMAXPROCS=1, gebunden an einen logischen
Prozessor, Testkonten aus DEV_SEED, TRUSTED_PROXIES=127.0.0.1/32 für wechselnde IP-Adressen, temporäre Datenbank. Danach
schickt TestLoginLoad (internal/http/login_load_test.go) die Anmeldeversuche und ruft den Healthcheck auf.
Das Skript misst Spitzen-Arbeitsspeicher und Prozessorzeit des Serverprozesses und gibt je Stufe eine
Tabellenzeile aus. Ergebnisse und Einordnung: docs/login-begrenzung.md.

Nur lokal unter Windows ausführen, nie gegen das Produktivsystem. Der Speicherbedarf steigt ohne die
Korrektur aus Ticket #138 um etwa 64 MiB je gleichzeitiger Anfrage; Stufen entsprechend klein wählen.

.EXAMPLE
./scripts/login-lasttest.ps1
Baut Server und Test aus dem aktuellen Stand und misst die Stufen 5, 10, 20, 40 und 80.

.EXAMPLE
./scripts/login-lasttest.ps1 -Server C:\tmp\server-main.exe -Stufen 5,10,15
Misst einen anderswo gebauten Server, etwa den Stand vor der Korrektur.
#>
param(
    [int[]]  $Stufen = @(5, 10, 20, 40, 80),
    [string] $Server = '',                               # fertige server.exe; leer: aus diesem Stand bauen
    [string] $Dauer = '3s',                              # Dauer je Stufe
    [int]    $Prozessor = [Environment]::ProcessorCount - 1,
    [int]    $Port = 18138
)
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$work = Join-Path ([IO.Path]::GetTempPath()) "login-lasttest-$PID"
New-Item -ItemType Directory -Force $work | Out-Null
$base = "http://127.0.0.1:$Port"

try {
    Push-Location $backend
    try {
        if (-not $Server) {
            $Server = Join-Path $work 'server.exe'
            go build -o $Server ./cmd/server
            if ($LASTEXITCODE -ne 0) { throw 'Server lässt sich nicht bauen.' }
        }
        $testBin = Join-Path $work 'http.test.exe'
        go test -c -o $testBin ./internal/http/
        if ($LASTEXITCODE -ne 0) { throw 'Lasttest lässt sich nicht bauen.' }
    } finally {
        Pop-Location
    }

    '| Parallel | Server: Spitze Arbeitsspeicher | Server: CPU-Zeit / Dauer | Anfragen | 401 | 503 | sonstige | Argon2/s | Login p50 / max | Health ok/gesamt | Health max |'
    '|---|---|---|---|---|---|---|---|---|---|---|'
    foreach ($n in $Stufen) {
        $data = Join-Path $work "stufe-$n"
        New-Item -ItemType Directory -Force $data | Out-Null
        $serverEnv = @{
            GOMAXPROCS = '1'; ADDR = "127.0.0.1:$Port"; DEV_SEED = 'true'; TRUSTED_PROXIES = '127.0.0.1/32'
            DATABASE_PATH = Join-Path $data 'app.db'; MEDIA_PATH = Join-Path $data 'media'
        }
        foreach ($k in $serverEnv.Keys) { Set-Item "Env:$k" $serverEnv[$k] }
        $p = Start-Process -FilePath $Server -PassThru -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $data 'server.log') -RedirectStandardError (Join-Path $data 'server.err')
        foreach ($k in $serverEnv.Keys) { Remove-Item "Env:$k" }
        try {
            $p.ProcessorAffinity = [IntPtr]([long]1 -shl $Prozessor)
            $ready = $false
            for ($i = 0; $i -lt 100 -and -not $ready; $i++) {
                try { $ready = (Invoke-WebRequest -UseBasicParsing "$base/api/health" -TimeoutSec 2).StatusCode -eq 200 }
                catch { Start-Sleep -Milliseconds 100 }
            }
            if (-not $ready) { throw "Server auf $base nicht erreichbar." }

            $p.Refresh()
            $cpuBefore = $p.TotalProcessorTime
            $env:LOGIN_LASTTEST = '1'; $env:LOGIN_LASTTEST_URL = $base
            $env:LOGIN_LASTTEST_STUFEN = "$n"; $env:LOGIN_LASTTEST_DAUER = $Dauer
            $watch = [Diagnostics.Stopwatch]::StartNew()
            $ErrorActionPreference = 'Continue'
            $out = & $testBin '-test.run=^TestLoginLoad$' '-test.v' '-test.count=1' 2>&1 | ForEach-Object { "$_" }
            $ErrorActionPreference = 'Stop'
            $watch.Stop()
            Remove-Item Env:LOGIN_LASTTEST, Env:LOGIN_LASTTEST_URL, Env:LOGIN_LASTTEST_STUFEN, Env:LOGIN_LASTTEST_DAUER
            $p.Refresh()

            # Zeile des Tests: | Parallel | Anfragen | 401 | 503 | sonstige | Argon2/s | Login | Speicher | CPU | Health | Health max |
            $cells = (($out | Select-String -Pattern "login_load_test.go:\d+: \| $n \|").Line -split '\|') | ForEach-Object { $_.Trim() }
            '| {0} | {1} MiB | {2:N2} s / {3:N1} s | {4} | {5} | {6} | {7} | {8} | {9} | {10} | {11} |' -f $n,
                [math]::Round($p.PeakWorkingSet64 / 1MB), ($p.TotalProcessorTime - $cpuBefore).TotalSeconds,
                $watch.Elapsed.TotalSeconds, $cells[2], $cells[3], $cells[4], $cells[5], $cells[6], $cells[7], $cells[10], $cells[11]
            $out | Select-String -Pattern '--- FAIL|login_load_test.go:\d+: Parallelität' | ForEach-Object { '  ' + $_.Line.Trim() }
        } finally {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            $p.WaitForExit(5000) | Out-Null
        }
    }
} finally {
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
