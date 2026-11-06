@echo off
title GESTOCK - Gestor Negocio
echo ========================================================
echo          GESTOCK - Gestor Negocio (Windows)
echo ========================================================
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: Asegurar PATH con las rutas de Python y Node.js
set "PATH=C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"

:: --- VERIFICAR E INICIAR BACKEND ---
echo [1/2] Verificando entorno de Backend...
cd /d "%ROOT_DIR%back"
if not exist ".env" (
    echo Creando archivo .env en back...
    copy .env.example .env >nul
)

if not exist ".venv\Scripts\python.exe" (
    echo Creando entorno virtual .venv de Python...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] No se pudo crear el entorno virtual de Python.
        echo Asegurate de tener Python 3.10+ instalado.
        pause
        exit /b 1
    )
)

echo Iniciando Backend (FastAPI en http://127.0.0.1:8000)...
start "GESTOCK - Backend (FastAPI)" cmd /c "cd /d "%ROOT_DIR%back" && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

:: --- VERIFICAR E INICIAR FRONTEND ---
echo [2/2] Verificando entorno de Frontend...
cd /d "%ROOT_DIR%front"
if not exist ".env" (
    echo Creando archivo .env en front...
    copy .env.example .env >nul
)

if not exist "node_modules" (
    echo Instalando dependencias de Node.js...
    call npm install
)

echo Iniciando Frontend (Vite en http://127.0.0.1:5173)...
start "GESTOCK - Frontend (Vite)" cmd /c "cd /d "%ROOT_DIR%front" && npm run dev"

echo.
echo ========================================================
echo  Servidores iniciados en segundo plano:
echo  - Backend:  http://127.0.0.1:8000
echo  - Frontend: http://127.0.0.1:5173
echo ========================================================
echo.
echo Abriendo el navegador en 3 segundos...
timeout /t 3 >nul
start http://127.0.0.1:5173

echo.
echo Para detener la aplicacion, cierra las ventanas de consola abiertas.
pause
