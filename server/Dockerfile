# Etapa de construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Etapa de producción
FROM node:18-alpine

WORKDIR /app

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Copiar dependencias de la etapa anterior
COPY --from=builder /app/node_modules ./node_modules

# Copiar código fuente
COPY . .

# Crear usuario no privilegiado
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Cambiar permisos
RUN chown -R nodejs:nodejs /app

# Cambiar al usuario no privilegiado
USER nodejs

# Exponer puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/get-ip || exit 1

# Comando de inicio
CMD ["node", "server.js"]
