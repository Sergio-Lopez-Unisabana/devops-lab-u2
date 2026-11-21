# CI/CD Lab — Node.js + Express + Docker

Laboratorio técnico ligero para evaluar flujos de **Integración Continua (CI)** y **Entrega Continua (CD)** usando Node.js 18, Express, Jest, Supertest, Docker, GitHub Actions y Jenkins.

El objetivo es disponer de una aplicación mínima, fácil de probar y contenerizar, que sirva como banco de pruebas para pipelines.

---

## Tabla de contenidos

1. [Requisitos](#requisitos)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Instalación y ejecución local](#instalación-y-ejecución-local)
4. [Endpoints](#endpoints)
5. [Pruebas automatizadas](#pruebas-automatizadas)
6. [Docker](#docker)
7. [Pipeline de CI — GitHub Actions](#pipeline-de-ci--github-actions)
8. [Pipeline de CD — Jenkins](#pipeline-de-cd--jenkins)
9. [Variables de entorno y credenciales](#variables-de-entorno-y-credenciales)
10. [Solución de problemas](#solución-de-problemas)

---

## Requisitos

| Herramienta | Versión mínima | Uso |
|---|---|---|
| Node.js | 18.x | Runtime de la aplicación |
| npm | 9.x | Gestión de dependencias |
| Docker | 20.x | Construcción y ejecución de la imagen |
| Git | 2.x | Control de versiones |

> El proyecto fija versiones exactas de dependencias y declara `"engines": { "node": ">=18" }`.

---

## Estructura del proyecto

```text
ci-cd-lab/
├── .dockerignore              # Exclusiones del contexto de build de Docker
├── .gitignore                 # Exclusiones de Git para entornos Node.js
├── Dockerfile                 # Imagen node:18-alpine, usuario "node", puerto 3000
├── Jenkinsfile                # Pipeline declarativo de CD (Docker Hub)
├── package.json               # Scripts y dependencias exactas
├── package-lock.json          # Árbol de dependencias reproducible (npm ci)
├── README.md                  # Esta documentación
├── app.js                     # Aplicación Express (exporta la app para tests)
├── server.js                  # Arranque del servidor y apagado ordenado
├── tests/
│   └── app.test.js            # Pruebas de Jest + Supertest
└── .github/
    └── workflows/
        └── ci.yml             # Pipeline de CI en GitHub Actions
```

La separación entre `app.js` y `server.js` permite que Supertest levante la app en memoria **sin abrir un puerto real**, evitando procesos colgantes.

---

## Instalación y ejecución local

```bash
# 1. Clonar el repositorio
git clone https://github.com/TU_USUARIO/ci-cd-lab.git
cd ci-cd-lab

# 2. Instalar dependencias exactas del lockfile
npm ci

# 3. Arrancar el servidor
npm start
```

Salida esperada:

```text
[server] Escuchando en http://localhost:3000
[server] Health check disponible en http://localhost:3000/health
```

Modo desarrollo con recarga automática (Node.js 18+):

```bash
npm run dev
```

---

## Endpoints

### `GET /`

```bash
curl -i http://localhost:3000/
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
```

```json
{
  "status": "success",
  "message": "Bienvenido al laboratorio CI/CD con Node.js, Express y Docker"
}
```

### `GET /health`

```bash
curl -i http://localhost:3000/health
```

```json
{ "status": "UP" }
```

### Rutas desconocidas

Cualquier otra ruta responde `404` con un JSON descriptivo:

```json
{
  "status": "error",
  "message": "Ruta no encontrada: GET /ruta-inexistente"
}
```

---

## Pruebas automatizadas

La suite usa **Jest** como runner y **Supertest** para las peticiones HTTP.

```bash
npm test
```

El script está definido como:

```json
"test": "jest --detectOpenHandles --forceExit"
```

- `--detectOpenHandles` detecta handles abiertos (sockets, timers) que impiden que Jest termine.
- `--forceExit` garantiza que el proceso de pruebas finalice siempre.

Resultado esperado:

```text
PASS tests/app.test.js
  GET /
    √ debe responder 200 con status "success" y un mensaje de bienvenida
  GET /health
    √ debe responder 200 con { status: "UP" }
  Rutas desconocidas
    √ debe responder 404 en JSON

Tests:       3 passed, 3 total
```

Cobertura opcional:

```bash
npx jest --coverage
```

---

## Docker

### Construir la imagen

```bash
docker build -t ci-cd-lab:local .
```

### Ejecutar el contenedor

```bash
docker run --rm -p 3000:3000 --name ci-cd-lab ci-cd-lab:local
```

### Verificar

```bash
curl http://localhost:3000/health
# {"status":"UP"}
```

### Detalles de la imagen

- Base `node:18-alpine` (imagen pequeña, superficie de ataque reducida).
- `npm ci --omit=dev`: solo dependencias de producción, instalación reproducible desde el lockfile.
- Se copian primero `package.json` y `package-lock.json` para aprovechar la caché de capas.
- `COPY --chown=node:node` y `USER node`: el proceso corre como usuario sin privilegios (uid 1000).
- `EXPOSE 3000` y `HEALTHCHECK` contra `/health`.
- `NODE_ENV=production` y `PORT=3000` por defecto.
- El `.dockerignore` excluye `node_modules`, `tests`, `.git`, `.github`, documentación y secretos, reduciendo el contexto de build.

### Inspeccionar el health check

```bash
docker inspect --format='{{json .State.Health}}' ci-cd-lab
```

---

## Pipeline de CI — GitHub Actions

Archivo: `.github/workflows/ci.yml`

**Disparadores**

- `push` a la rama `main`
- `pull_request` hacia la rama `main`

**Pasos**

1. `actions/checkout@v4` — clona el repositorio.
2. `actions/setup-node@v4` — instala Node.js 18 con `cache: npm` (cachea `~/.npm` usando `package-lock.json` como clave).
3. `npm ci` — instalación reproducible y estricta desde el lockfile.
4. `npm test` — ejecuta Jest con `--detectOpenHandles --forceExit`.

Además incluye:

- `permissions: contents: read` (mínimo privilegio).
- `concurrency` para cancelar ejecuciones obsoletas de la misma rama.

**Verificación local del workflow** (opcional, con [act](https://github.com/nektos/act)):

```bash
act push
```

---

## Pipeline de CD — Jenkins

Archivo: `Jenkinsfile` (sintaxis declarativa).

**Stages obligatorios**

| Stage | Descripción |
|---|---|
| `Checkout Source` | `checkout scm` y muestra el commit corto. |
| `Build Docker Image` | Construye la imagen con etiquetas `:<BUILD_NUMBER>` y `:latest`, añadiendo labels OCI (`revision`, `created`). |
| `Push to Registry` | Login en Docker Hub con `withCredentials`, push de ambas etiquetas y `docker logout`. |

**Bloque `post`**

- `success`: mensaje con las imágenes publicadas.
- `failure`: mensaje indicando el build fallido.
- `unstable` / `aborted`: mensajes de estado.
- `always`: elimina las imágenes locales (`docker rmi -f`), hace `docker image prune` filtrando por el label de revisión y limpia el workspace con `cleanWs()`.

**Configuración previa en Jenkins**

1. Instalar los plugins **Docker Pipeline** (o disponer de Docker CLI en el agente) y **Credentials Binding**.
2. Crear la credencial **Username with password** con ID `dockerhub-credentials`:
   - Usuario: tu usuario de Docker Hub.
   - Contraseña: un **Access Token** de Docker Hub (no la contraseña de la cuenta).
3. Ajustar en el `Jenkinsfile` la variable `DOCKERHUB_USER` con tu usuario real.
4. Crear un job **Pipeline** apuntando al repositorio (o usar `Pipeline script from SCM` con `Jenkinsfile`).

**Resultado**

```text
docker.io/TU_USUARIO/ci-cd-lab:<BUILD_NUMBER>
docker.io/TU_USUARIO/ci-cd-lab:latest
```

---

## Variables de entorno y credenciales

| Variable | Dónde se define | Valor por defecto | Descripción |
|---|---|---|---|
| `PORT` | Entorno / Docker | `3000` | Puerto HTTP de la aplicación |
| `NODE_ENV` | Dockerfile | `production` | Entorno de ejecución |
| `DOCKERHUB_CREDENTIALS` | `Jenkinsfile` | `dockerhub-credentials` | ID de la credencial de Jenkins |
| `DOCKERHUB_USER` | `Jenkinsfile` | `TU_USUARIO_DOCKERHUB` | Usuario/organización de Docker Hub |
| `IMAGE_NAME` | `Jenkinsfile` | `ci-cd-lab` | Nombre de la imagen |
| `IMAGE_TAG` | `Jenkinsfile` | `${BUILD_NUMBER}` | Etiqueta de versión |

> Nunca se almacenan secretos en el repositorio. Las credenciales viven en Jenkins y en GitHub Secrets (si se añaden en el futuro).

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `npm ci` falla con "lockfile out of sync" | `package.json` y `package-lock.json` no coinciden | Ejecutar `npm install` y commitear el lockfile |
| Jest no termina | Handle abierto (servidor escuchando) | La app se importa desde `app.js`, no desde `server.js`; se usan `--detectOpenHandles --forceExit` |
| `docker build` falla en `npm ci` | Falta `package-lock.json` o está desactualizado | Regenerar el lockfile y reconstruir |
| `docker push` devuelve 401 | Credencial inválida o sin permisos | Verificar el ID `dockerhub-credentials` y usar un Access Token |
| El contenedor no responde | `PORT` distinto o health check fallando | Revisar `docker logs` y `docker inspect .State.Health` |
| Permiso denegado al escribir en el contenedor | Proceso ejecutándose como root o directorio sin permisos | Mantener `USER node` y `COPY --chown=node:node` |

---

## Licencia

MIT.
