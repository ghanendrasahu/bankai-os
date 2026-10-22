# syntax=docker/dockerfile:1
# Hugging Face Space image: build the npm workspace once (server + dashboard)
# and run the single Fastify process. Listens on 0.0.0.0:7860 so the Space
# proxy can route traffic without extra metadata.
FROM node:20-slim AS build

ENV NODE_ENV=development
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.base.json vitest.config.ts ./
COPY packages ./packages
COPY apps ./apps
RUN npm run build

FROM node:20-slim

ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=1024 \
    HOST=0.0.0.0 \
    PORT=7860 \
    STORAGE_ROOT=/data \
    LOG_LEVEL=info

WORKDIR /app

# node_modules ships the platform-specific better-sqlite3 binary from build.
COPY --from=build /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data
USER appuser

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:7860/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/dist/index.js"]
