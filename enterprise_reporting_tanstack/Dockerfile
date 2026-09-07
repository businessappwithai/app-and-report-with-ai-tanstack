# ==========================================
# Enterprise Reporting System
# Production Dockerfile - Bun + TanStack Start + PostgreSQL
# ==========================================

# Build stage - Pure Bun
FROM oven/bun:1.3 AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and source
COPY package.json bun.lock ./
COPY . .

# Install dependencies with Bun (frozen lockfile)
RUN bun install --frozen-lockfile && bun pm cache rm

# Build application with TanStack Start
RUN bun run build

# Production stage - Runtime only
FROM oven/bun:1.3-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    postgresql-client \
    redis-tools \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 bunuser && \
    useradd -r -u 1001 -g bunuser bunuser

# Copy package files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

# Copy built application (Vite output structure)
COPY --from=builder --chown=bunuser:bunuser /app/dist ./dist
COPY --from=builder --chown=bunuser:bunuser /app/public ./public
COPY --from=builder --chown=bunuser:bunuser /app/node_modules ./node_modules

# Copy database scripts (needed for runtime initialization)
COPY --chown=bunuser:bunuser scripts ./scripts
COPY --chown=bunuser:bunuser src/lib/db ./src/lib/db
COPY --chown=bunuser:bunuser src/lib/security ./src/lib/security

# Copy server wrapper for static file serving
COPY --chown=bunuser:bunuser server-static-wrapper.mjs ./server-static-wrapper.mjs

# Create required directories with correct permissions
RUN mkdir -p /app/data /app/logs && \
    chown -R bunuser:bunuser /app/data /app/logs && \
    chmod -R 755 /app/dist/client && \
    chmod -R 755 /app/public

# Expose application port
EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000 \
    PUBLIC_DIR=/app/dist/client

# Switch to non-root user
USER bunuser

HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=10 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["bun", "server-static-wrapper.mjs"]
