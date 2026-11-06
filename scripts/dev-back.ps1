Set-Location $PSScriptRoot\..\back

# Asegurar rutas estándar en PATH
$env:PATH = "C:\Program Files\nodejs;$env:LOCALAPPDATA\Programs\Python\Python312;$env:LOCALAPPDATA\Programs\Python\Python312\Scripts;" + $env:PATH

# Buscar ejecutable de Python disponible
$pythonCmd = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
if (-not $pythonCmd) {
    $fallbackPy = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    if (Test-Path $fallbackPy) {
        $pythonCmd = $fallbackPy
    } else {
        throw "No se encontro Python 3.10+. Asegurate de tener Python instalado y accesible."
    }
}

# Crear entorno virtual si no existe
if (-not (Test-Path .venv\Scripts\python.exe)) {
    Write-Host "[Backend] Creando entorno virtual .venv..." -ForegroundColor Yellow
    & $pythonCmd -m venv .venv
}

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}

Write-Host "[Backend] Verificando dependencias..." -ForegroundColor Green
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt --quiet

Write-Host "[Backend] Iniciando Uvicorn en http://127.0.0.1:8000 ..." -ForegroundColor Cyan
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

