# Getting Started

## Objetivo de esta guia

Esta guia explica como preparar el entorno local para trabajar o probar el proyecto desde cero.

Aplica para:

- quien clona el repo por primera vez
- quien quiere probar el proyecto manualmente
- quien necesita reconstruir el entorno en otra PC

## Requisitos previos

### Backend

- `Python 3.10` o superior
- `pip`

### Frontend

- `Node.js 20 LTS` o superior
- `npm 10` o superior

## Verificar instalaciones

Abrir PowerShell y ejecutar:

```powershell
python --version
pip --version
node --version
npm --version
```

Si `node` o `npm` no aparecen:

- cerrar y volver a abrir la terminal
- cerrar y volver a abrir VS Code
- verificar que `C:\Program Files\nodejs` este en el `PATH`

## Clonar el repositorio

```powershell
git clone https://github.com/Eze421/Gestor-negocio.git
cd Gestor-negocio
```

## Preparar el backend

### 1. Ir a la carpeta del backend

```powershell
cd back
```

### 2. Crear un entorno virtual

```powershell
python -m venv .venv
```

### 3. Activar el entorno virtual

```powershell
.\.venv\Scripts\activate
```

### 4. Instalar dependencias

Opcion recomendada:

```powershell
pip install -r requirements.txt
```

Opcion alternativa usando metadatos del proyecto:

```powershell
pip install -e .[dev]
```

### 5. Crear archivo de entorno

```powershell
copy .env.example .env
```

### 6. Levantar la API

```powershell
uvicorn app.main:app --reload
```

### 7. Verificar creacion de base de datos

Despues del primer arranque correcto del backend, deberia existir:

- `back/data/gestor_negocio.db`

Y tambien pueden aparecer archivos auxiliares de SQLite como:

- `.db-wal`
- `.db-shm`

Eso es esperado y no se versiona en Git.

## Preparar el frontend

### 1. Ir a la carpeta del frontend

Desde la raiz del repo:

```powershell
cd front
```

### 2. Crear archivo de entorno

```powershell
copy .env.example .env
```

### 3. Instalar dependencias

```powershell
npm install
```

### 4. Levantar el frontend

```powershell
npm run dev
```

## URLs esperadas

- backend root: `http://127.0.0.1:8000/`
- backend health: `http://127.0.0.1:8000/api/health`
- backend modules: `http://127.0.0.1:8000/api/modules`
- frontend: `http://127.0.0.1:5173`

## Scripts de arranque automatizado

Para facilitar el desarrollo local, disponemos de scripts de arranque según tu sistema operativo:

### Linux / macOS
En la raíz del proyecto, tienes un script unificado que inicializa tanto el frontend como el backend en paralelo, instalando dependencias y preparando el entorno si no existen:

```bash
./dev.sh
```

Al presionar `Ctrl + C`, el script detiene automáticamente ambos servidores de forma limpia.

### Windows (PowerShell)
En la carpeta `scripts/` hay ayudas de arranque independientes:

- `scripts/dev-back.ps1`
- `scripts/dev-front.ps1`

Sirven para automatizar el arranque local después de entender el proceso manual.

### Que hace cada script

`scripts/dev-back.ps1`

- entra a `back/`
- crea `.venv` si hace falta
- activa el entorno virtual
- crea `.env` desde `.env.example` si no existe
- actualiza `pip`
- instala dependencias desde `requirements.txt`
- levanta `uvicorn`
- genera la base SQLite si todavia no existe

`scripts/dev-front.ps1`

- entra a `front/`
- crea `.env` desde `.env.example` si no existe
- detecta `npm` incluso si no quedo bien en el `PATH`
- instala dependencias si `node_modules` no existe
- abre el navegador en `http://127.0.0.1:5173`
- levanta Vite con `npm run dev`

### Como ejecutar los scripts correctamente

#### Si estas parado en la raiz del repo

```powershell
.\scripts\dev-back.ps1
.\scripts\dev-front.ps1
```

#### Si estas parado dentro de la carpeta `scripts`

```powershell
.\dev-back.ps1
.\dev-front.ps1
```

#### Si estas parado dentro de `back`

```powershell
..\scripts\dev-back.ps1
```

#### Si estas parado dentro de `front`

```powershell
..\scripts\dev-front.ps1
```

### Importante

Los scripts se ejecutan segun la carpeta actual de PowerShell.

Ejemplo:

- si estas en `...\Gestor-negocio\back`, entonces `.\dev-back.ps1` falla
- falla porque ese archivo no esta dentro de `back/`
- en ese caso tenes que usar `..\scripts\dev-back.ps1`

### Recomendacion practica

La forma mas simple es ejecutar siempre los scripts desde la raiz del repo:

```powershell
cd c:\Users\mateo\Documents\github\repos\Gestor-negocio
.\scripts\dev-back.ps1
```

o:

```powershell
cd c:\Users\mateo\Documents\github\repos\Gestor-negocio
.\scripts\dev-front.ps1
```

### Que esperar al usar `dev-front.ps1`

Cuando ejecutes el script:

1. va a preparar el entorno del frontend
2. va a abrir el navegador automaticamente
3. va a dejar Vite corriendo en la terminal actual

Eso significa que:

- esa terminal queda ocupada por el proceso del frontend
- para frenarlo tenes que usar `Ctrl + C`
- si queres volver a lanzarlo, ejecutas el script otra vez

## Problemas comunes

### `node` o `npm` no se reconoce

Causa probable:

- Node instalado pero no visible en el `PATH`

Soluciones:

- cerrar y reabrir terminal
- reiniciar VS Code
- verificar `C:\Program Files\nodejs` en el `PATH`
- probar con:

```powershell
& "C:\Program Files\nodejs\npm.cmd" --version
```

### Error al activar el entorno virtual

Si PowerShell bloquea scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### `uvicorn` no encontrado

Significa que el entorno virtual no esta activo o que faltan dependencias. Reactivar `.venv` y reinstalar.

### `pip install -e .[dev]` falla

En este proyecto, la forma recomendada es:

```powershell
pip install -r requirements.txt
```

Esto evita problemas de compatibilidad con algunas versiones de `pip` al instalar en modo editable.

### El script existe pero PowerShell dice que no lo encuentra

Causa probable:

- estas parado en otra carpeta

Ejemplos:

- desde `back/` usar `..\scripts\dev-back.ps1`
- desde `front/` usar `..\scripts\dev-front.ps1`
- desde la raiz usar `.\scripts\dev-back.ps1` o `.\scripts\dev-front.ps1`

### `npm install` falla

Revisar:

- que `node --version` funcione
- que `npm --version` funcione
- que estes parado en `front/`
- que exista [front/package.json](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/front/package.json)
