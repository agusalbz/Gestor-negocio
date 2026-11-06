#!/usr/bin/env bash

# Colores para la consola
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Iniciando Gestor Negocio (Entorno de Desarrollo) ===${NC}"

# Función de limpieza al detener el script
cleanup() {
    echo -e "\n${YELLOW}Deteniendo servidores...${NC}"
    # Matar todos los procesos secundarios iniciados por este script bash
    kill $(jobs -p) 2>/dev/null
    exit
}

# Capturar señal de Ctrl+C (SIGINT) y SIGTERM para apagar todo ordenadamente
trap cleanup SIGINT SIGTERM

# Directorio raíz del proyecto
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- CONFIGURAR E INICIAR BACKEND ---
echo -e "\n${GREEN}[Backend] Preparando entorno...${NC}"
cd "$ROOT_DIR/back"

# Verificar si el entorno virtual existente es válido para este directorio
if [ -d ".venv" ]; then
    # Leer la shebang de pip para verificar si apunta a un python existente en esta máquina
    VENV_SHEBANG_PYTHON=$(head -n 1 .venv/bin/pip 2>/dev/null | sed 's/^#!//')
    if [ -z "$VENV_SHEBANG_PYTHON" ] || [ ! -f "$VENV_SHEBANG_PYTHON" ]; then
        echo -e "${YELLOW}[Backend] Se detectó un entorno virtual con rutas rotas o copiado de otra ubicación. Recreando .venv...${NC}"
        rm -rf .venv
    fi
fi

# Crear entorno virtual si no existe o fue eliminado
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}[Backend] Entorno virtual (.venv) no encontrado. Creándolo...${NC}"
    python3 -m venv .venv || { echo -e "${RED}[Backend] Error al crear .venv. Asegúrate de tener python3-venv instalado.${NC}"; exit 1; }
fi

# Activar entorno virtual
source .venv/bin/activate || { echo -e "${RED}[Backend] Error al activar .venv${NC}"; exit 1; }

# Crear .env desde el de ejemplo si no existe
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[Backend] Creando archivo .env desde .env.example...${NC}"
    cp .env.example .env
fi

# Instalar dependencias del backend usando el pip del entorno virtual directamente
echo -e "${GREEN}[Backend] Verificando e instalando dependencias (requirements.txt)...${NC}"
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt || { echo -e "${RED}[Backend] Error al instalar dependencias del backend.${NC}"; exit 1; }

# Levantar el backend en segundo plano usando el uvicorn del entorno virtual directamente
echo -e "${GREEN}[Backend] Iniciando servidor FastAPI con Uvicorn...${NC}"
.venv/bin/uvicorn app.main:app --reload &

# --- CONFIGURAR E INICIAR FRONTEND ---
echo -e "\n${BLUE}[Frontend] Preparando entorno...${NC}"
cd "$ROOT_DIR/front"

# Crear .env si no existe
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[Frontend] Creando archivo .env desde .env.example...${NC}"
    cp .env.example .env
fi

# Verificar si node_modules está roto o copiado de otra ruta
if [ -d "node_modules" ]; then
    if ! ./node_modules/.bin/vite --version &>/dev/null; then
        echo -e "${YELLOW}[Frontend] Se detectaron dependencias de Node rotas o copiadas de otra ruta. Reinstalando node_modules...${NC}"
        rm -rf node_modules
    fi
fi

# Instalar dependencias si no existe node_modules o fue eliminado
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[Frontend] Carpeta node_modules no encontrada o inválida. Instalando dependencias de Node...${NC}"
    npm install || { echo -e "${RED}[Frontend] Error al instalar dependencias del frontend.${NC}"; exit 1; }
fi

# Levantar el frontend en segundo plano
echo -e "${BLUE}[Frontend] Iniciando servidor de desarrollo con Vite...${NC}"
npm run dev &

echo -e "\n${GREEN}=== Servidores iniciados con éxito ===${NC}"
echo -e "Backend expuesto en:  ${BLUE}http://127.0.0.1:8000${NC} (Documentación: http://127.0.0.1:8000/docs)"
echo -e "Frontend expuesto en: ${BLUE}http://127.0.0.1:5173${NC}"
echo -e "${YELLOW}Presiona Ctrl+C en cualquier momento para detener ambos servidores.${NC}\n"

# Mantener el script corriendo y esperar a los procesos secundarios
wait
