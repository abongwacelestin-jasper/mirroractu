# MirrorActu API. Build from the repository root, because first-run content is read from src/data:
#
#   docker build -f server/Dockerfile -t mirroractu-api .

FROM node:22-alpine AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
# The snapshot the API loads into an empty database on first start.
COPY src/data /app/src/data
RUN npm run typecheck && npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server/dist ./dist
COPY server/migrations ./migrations
# Run as the unprivileged "node" user that the image provides.
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT:-4000}/api/v1/health || exit 1
CMD ["node", "dist/index.js"]
