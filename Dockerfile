# MirrorActu: build the site with Node, serve it with nginx.
#
#   docker build -t mirroractu .
#   docker run -p 8080:8080 mirroractu      → http://localhost:8080
#
# The VITE_* values are read while the site is built, not when the container starts,
# so pass them as build arguments (docker-compose.yml does this from a .env file).

# ---------- 1. Build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so this layer is reused until package files change.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

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

# The port to listen on. Railway and similar hosts set PORT themselves; otherwise 8080.
# API_UPSTREAM is where /api/ requests are sent: the API service's private address.
ENV PORT=8080 \
    API_UPSTREAM=http://api:4000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="^(PORT|API_UPSTREAM|NGINX_LOCAL_RESOLVERS)$"

# Turned into /etc/nginx/conf.d/default.conf at start-up, with ${PORT} filled in.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/healthz || exit 1
