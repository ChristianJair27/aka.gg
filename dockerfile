# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Copiar manifiestos e instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar resto del proyecto
COPY . .

# Compilar proyecto Vite
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.25-alpine

# Copiar configuración de Nginx personalizada para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar artefactos de build
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1