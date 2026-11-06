# ========================================================
#          GESTOCK - Gestor Negocio (PowerShell)
# ========================================================

Write-Host "=== Iniciando Gestor Negocio (Windows / PowerShell) ===" -ForegroundColor Blue

$rootDir = $PSScriptRoot

# Asegurar variables de entorno
$env:PATH = "C:\Program Files\nodejs;$env:LOCALAPPDATA\Programs\Python\Python312;$env:LOCALAPPDATA\Programs\Python\Python312\Scripts;" + $env:PATH

# --- CONFIGURAR BACKEND ---
Write-Host "`n[Backend] Preparando entorno..." -ForegroundColor Green
Set-Location "$rootDir\back"

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}

if (-not (Test-Path .venv\Scripts\python.exe)) {
    Write-Host "[Backend] Creando entorno virtual .venv..." -ForegroundColor Yellow
    $pyCmd = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
    if (-not $pyCmd) { $pyCmd = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" }
    & $pyCmd -m venv .venv
}

Write-Host "[Backend] Verificando dependencias..." -ForegroundColor Green
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt --quiet

# --- CONFIGURAR FRONTEND ---
Write-Host "`n[Frontend] Preparando entorno..." -ForegroundColor Blue
Set-Location "$rootDir\front"

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}

$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = "C:\Program Files\nodejs\npm.cmd" }

if (-not (Test-Path node_modules)) {
    Write-Host "[Frontend] Instalando dependencias de Node..." -ForegroundColor Yellow
    & $npmCmd install
}

# --- INICIAR SERVIDORES ---
Write-Host "`n=== Iniciando servidores ===" -ForegroundColor Cyan
Write-Host "Backend:  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "Presiona Ctrl+C para detener ambos procesos.`n" -ForegroundColor Yellow

$backJob = Start-Process -FilePath "$rootDir\back\.venv\Scripts\python.exe" `
    -ArgumentList "-m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" `
    -WorkingDirectory "$rootDir\back" `
    -PassThru

$frontJob = Start-Process -FilePath $npmCmd `
    -ArgumentList "run dev" `
    -WorkingDirectory "$rootDir\front" `
    -PassThru

# Abrir navegador tras pausa
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://127.0.0.1:5173"
} | Out-Null

try {
    # Esperar hasta que se interrumpa
    Wait-Process -Id $backJob.Id, $frontJob.Id
} finally {
    Write-Host "`nDeteniendo servidores..." -ForegroundColor Yellow
    Stop-Process -Id $backJob.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontJob.Id -ErrorAction SilentlyContinue
}
