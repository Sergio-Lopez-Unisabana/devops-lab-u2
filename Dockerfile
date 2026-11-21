# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Etapa única: imagen final mínima con solo dependencias de producción.
# ---------------------------------------------------------------------------
FROM node:18-alpine

# Directorio de trabajo propiedad del usuario sin privilegios "node".
WORKDIR /usr/src/app

# Copiamos primero los manifiestos para aprovechar la caché de capas:
# si el código cambia pero las dependencias no, no se reinstalan.
COPY package.json package-lock.json ./

# Instalamos solo dependencias de producción y limpiamos la caché de npm.
RUN npm ci --omit=dev && npm cache clean --force

# Copiamos el código con permisos del usuario "node".
COPY --chown=node:node app.js server.js ./

# Variables de entorno de producción.
ENV NODE_ENV=production \
    PORT=3000

# Ejecutamos como usuario sin privilegios (uid 1000, incluido en la imagen).
USER node

EXPOSE 3000

# Health check nativo de Docker contra el endpoint /health.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
