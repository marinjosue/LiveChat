# Etapa de construcción
FROM node:18-alpine AS builder

# Instalar herramientas de seguridad y utilidades
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Argumento para la URL del socket
ARG REACT_APP_SOCKET_URL=http://localhost:3001
ARG GENERATE_SOURCEMAP=false
ARG NODE_ENV=production

# Variables de entorno
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL \
    GENERATE_SOURCEMAP=$GENERATE_SOURCEMAP \
    NODE_ENV=$NODE_ENV \
    DISABLE_ESLINT_PLUGIN=true

# Copiar archivos de configuración primero (para mejor cache)
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build \
    && rm -rf node_modules src public package*.json

# Etapa de producción con nginx
FROM nginx:alpine

# Instalar curl para health checks
RUN apk add --no-cache curl \
    && rm -rf /var/cache/apk/*

# Copiar archivos estáticos construidos
COPY --from=builder /app/build /usr/share/nginx/html

# Copiar configuración personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Configurar permisos seguros
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

# Exponer puerto 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Labels para metadatos
LABEL maintainer="LiveChat Team" \
      description="LiveChat Client - React Application with Nginx" \
      version="1.0"

# Comando de inicio
CMD ["nginx", "-g", "daemon off;"]
