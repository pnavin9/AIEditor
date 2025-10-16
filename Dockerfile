# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (leverage cache)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source
COPY . .

# Build static assets
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app

# Copy only runtime essentials
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy server and built assets
COPY --from=builder /app/dist ./dist
COPY server.cjs ./server.cjs
COPY manual.mmd ./manual.mmd

# Expose server port
EXPOSE 3001

# Default command: run API/static server
CMD ["node", "server.cjs"]

