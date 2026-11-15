# MirrorActu: build with Node, serve with nginx. One file builds two separate websites:
#
#   docker build -t mirroractu .                                  the public site (no dashboard in it)
#   docker build -t mirroractu-admin --build-arg APP_TARGET=admin .   the staff dashboard
#
#   docker run -p 8080:8080 mirroractu      → http://localhost:8080
#
# The VITE_* values are read while the site is built, not when the container starts,
# so pass them as build arguments (docker-compose.yml does this from a .env file).

# Which image this file produces: site (public website), admin (staff dashboard) or api (the API).
ARG APP_TARGET=site

# ---------- 1. Build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so this layer is reused until package files change.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Which website to build: "site" (public) or "admin" (staff dashboard).
ARG APP_TARGET=site
# The public site's address, used by the dashboard for its "View the site" links.
ARG VITE_SITE_URL=""
ENV VITE_APP_TARGET=$APP_TARGET \
    VITE_SITE_URL=$VITE_SITE_URL

# Google advertising and geo lookup. All optional: leave empty for house adverts only.
ARG VITE_ADSENSE_CLIENT=""
ARG VITE_ADSENSE_SLOT_LEADERBOARD=""
ARG VITE_ADSENSE_SLOT_MPU=""
ARG VITE_ADSENSE_SLOT_HALFPAGE=""
ARG VITE_ADSENSE_SLOT_INFEED=""
ARG VITE_IMA_AD_TAG=""
ARG VITE_GEO_ENDPOINT=""
ENV VITE_ADSENSE_CLIENT=$VITE_ADSENSE_CLIENT \
    VITE_ADSENSE_SLOT_LEADERBOARD=$VITE_ADSENSE_SLOT_LEADERBOARD \
    VITE_ADSENSE_SLOT_MPU=$VITE_ADSENSE_SLOT_MPU \
    VITE_ADSENSE_SLOT_HALFPAGE=$VITE_ADSENSE_SLOT_HALFPAGE \
    VITE_ADSENSE_SLOT_INFEED=$VITE_ADSENSE_SLOT_INFEED \
    VITE_IMA_AD_TAG=$VITE_IMA_AD_TAG \
    VITE_GEO_ENDPOINT=$VITE_GEO_ENDPOINT

RUN npm run typecheck && npm run build

# ---------- 2. Serve ----------
# The unprivileged image runs nginx as a normal user on port 8080, not as root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS serve
ARG APP_TARGET=site

# The port to listen on. Railway and similar hosts set PORT themselves; otherwise 8080.
# API_UPSTREAM is where /api/ requests are sent: the API service's private address.
ENV PORT=8080 \
    API_UPSTREAM=http://api:4000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    ADMIN_GATEWAY_KEY="" \
    NGINX_ENVSUBST_FILTER="^(PORT|API_UPSTREAM|ADMIN_GATEWAY_KEY|NGINX_LOCAL_RESOLVERS)$"

# Turned into /etc/nginx/conf.d/default.conf at start-up, with ${PORT} filled in.
# Both server configs are copied and the one for this target is picked, so that a build that
# does not use this stage (APP_TARGET=api) is still valid on builders that read every stage.
COPY deploy/nginx.site.conf.template deploy/nginx.admin.conf.template /tmp/
USER root
RUN if [ -f "/tmp/nginx.${APP_TARGET}.conf.template" ]; then f="/tmp/nginx.${APP_TARGET}.conf.template"; else f=/tmp/nginx.site.conf.template; fi \
 && mkdir -p /etc/nginx/templates && cp "$f" /etc/nginx/templates/default.conf.template && rm /tmp/nginx.*.conf.template
USER nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/healthz || exit 1

# ---------- 3. The API (APP_TARGET=api) ----------
# Same steps as server/Dockerfile. It exists here so a host that insists on this file
# (Railway applies the root railway.json to every service in the repository) can still build the API.
FROM node:22-alpine AS api-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
COPY src/data /app/src/data
RUN npm run typecheck && npm run build

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=api-build /app/server/dist ./dist
COPY server/migrations ./migrations
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT:-4000}/healthz || exit 1
CMD ["node", "dist/index.js"]

# ---------- Pick the image ----------
FROM serve AS target-site
FROM serve AS target-admin
FROM api AS target-api
FROM target-${APP_TARGET}
