# Gestor Negocio

Reinicio completo del sistema con una base nueva, mas mantenible y mas clara para evolucionar.

La carpeta `guia_prototipo/` se conserva como referencia historica del sistema anterior. El trabajo real de esta nueva etapa vive dentro de `Gestor-negocio/`.

## Que es este proyecto

`Gestor Negocio` es un sistema local para administrar operaciones de un negocio desde el navegador, sin depender de una aplicacion de escritorio clasica.

La idea tecnica es simple:

- un `backend` local expone una API en la propia PC del usuario
- un `frontend` web corre en el navegador y consume esa API local
- la persistencia principal es local

## Objetivos de esta nueva version

- reconstruir el sistema desde cero
- mejorar arquitectura y mantenibilidad
- separar interfaz, dominio, persistencia y configuracion
- evitar acoplamientos fuertes del prototipo anterior
- documentar el proyecto desde el inicio
- facilitar pruebas manuales y desarrollo colaborativo

## Stack elegido

### Backend

- `Python 3.10+`
- `FastAPI`
- `SQLAlchemy`
- `SQLite`
- `Pydantic`

### Frontend

- `Node.js 20 LTS+`
- `npm 10+`
- `React`
- `TypeScript`
- `Vite`

## Arquitectura general

La aplicacion corre en dos procesos:

1. API local en `http://127.0.0.1:8000`
2. Frontend local en `http://127.0.0.1:5173`

El usuario final interactua desde el navegador, pero tanto la logica como los datos viven localmente.

Mas detalle en [docs/architecture.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/architecture.md).

## Estructura del repositorio

```text
Gestor-negocio/
|-- back/
|   |-- app/
|   |   |-- api/
|   |   |-- core/
|   |   |-- db/
|   |   |-- models/
|   |   |-- repositories/
|   |   |-- schemas/
|   |   `-- services/
|   |-- tests/
|   |-- .env.example
|   |-- pyproject.toml
|   `-- requirements.txt
|-- front/
|   |-- public/
|   |-- src/
|   |   |-- app/
|   |   |-- features/
|   |   |-- layouts/
|   |   |-- pages/
|   |   `-- shared/
|   |-- .env.example
|   |-- package.json
|   |-- requirements.txt
|   |-- tsconfig.json
|   `-- vite.config.ts
|-- docs/
|   |-- architecture.md
|   |-- getting-started.md
|   |-- manual-testing.md
|   `-- repository-guide.md
`-- scripts/
```

## Modulos previstos

- dashboard
- ventas
- caja
- cobros
- inventario
- clientes
- categorias
- proveedores
- autenticacion y licencia local

## Estado actual

La base del proyecto ya esta creada:

- backend con estructura por capas
- frontend con estructura por features
- endpoints iniciales de salud y listado de modulos
- CRUD real para categorias y productos en backend
- CRUD real para clientes y proveedores en backend
- flujo real de ventas con pagos y movimientos de caja en backend
- archivos de entorno de ejemplo
- scripts de arranque
- documentacion inicial

Todavia no estan implementadas las entidades reales del negocio ni los casos de uso finales.

## Como empezar rapido

Si acabas de clonar el repo, segui esta guia:

1. Lee [docs/repository-guide.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/repository-guide.md)
2. Configura el entorno con [docs/getting-started.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/getting-started.md)
3. Valida el arranque con [docs/manual-testing.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/manual-testing.md)

## Arranque rápido unificado (Linux / macOS)

Si utilizas Linux o macOS, puedes levantar todo el entorno (frontend y backend en paralelo) ejecutando un único comando desde la raíz del proyecto:

```bash
./dev.sh
```

Este script automatiza la creación del entorno virtual de Python, copia los archivos `.env.example` a `.env`, instala todas las dependencias y enciende ambos servidores. Presiona `Ctrl + C` para apagar ambos servicios al mismo tiempo.

## Arranque rápido manual (Windows / Paso a Paso)

### Backend

```powershell
cd back
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd front
copy .env.example .env
npm install
npm run dev
```

## Endpoints actuales

- `GET /`
- `GET /api/health`
- `GET /api/modules`
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/{id}`
- `DELETE /api/categories/{id}`
- `GET /api/clients`
- `GET /api/clients/{id}`
- `POST /api/clients`
- `PATCH /api/clients/{id}`
- `DELETE /api/clients/{id}`
- `GET /api/products`
- `GET /api/products/{id}`
- `POST /api/products`
- `PATCH /api/products/{id}`
- `DELETE /api/products/{id}`
- `GET /api/sales`
- `GET /api/sales/pending`
- `GET /api/sales/{id}`
- `POST /api/sales`
- `POST /api/sales/{id}/payments`
- `GET /api/suppliers`
- `GET /api/suppliers/{id}`
- `POST /api/suppliers`
- `PATCH /api/suppliers/{id}`
- `DELETE /api/suppliers/{id}`

## Filosofia de trabajo

- mantener el dominio separado de la UI
- crear una base facil de testear
- agregar documentacion junto con la estructura
- priorizar claridad sobre atajos rapidos

## Documentacion disponible

- [docs/architecture.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/architecture.md): arquitectura y decisiones base
- [docs/database-schema.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/database-schema.md): detalle de tablas, relaciones y equivalencia con el prototipo
- [docs/getting-started.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/getting-started.md): instalacion y puesta en marcha
- [docs/manual-testing.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/manual-testing.md): checklist de prueba manual
- [docs/repository-guide.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/repository-guide.md): guia para quienes clonen y trabajen en el repo
- [docs/project-journal.md](/c:/Users/mateo/Documents/github/repos/Gestor-negocio/docs/project-journal.md): registro historico de cambios, errores y soluciones
