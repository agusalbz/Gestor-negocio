Set-Location $PSScriptRoot\..\front

# Asegurar que node y npm esten en PATH
$env:PATH = "C:\Program Files\nodejs;$env:LOCALAPPDATA\Programs\Python\Python312;$env:LOCALAPPDATA\Programs\Python\Python312\Scripts;" + $env:PATH

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}

$npmCommand = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCommand) {
    $defaultNpm = "C:\Program Files\nodejs\npm.cmd"
    if (Test-Path $defaultNpm) {
        $npmCommand = $defaultNpm
    } else {
        throw "No se encontro npm. Verifica la instalacion de Node.js y el PATH."
    }
}

if (-not (Test-Path node_modules)) {
    Write-Host "[Frontend] Instalando dependencias de Node..." -ForegroundColor Yellow
    & $npmCommand install
}

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://127.0.0.1:5173"
} | Out-Null

Write-Host "[Frontend] Iniciando Vite en http://127.0.0.1:5173 ..." -ForegroundColor Cyan
& $npmCommand run dev

