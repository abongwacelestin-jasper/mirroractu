# MirrorActu: ONE image for all three services. What a container does is chosen when it
# starts, by the APP_TARGET variable:
#
#   APP_TARGET=site    the public website           (default)   nginx, port $PORT or 8080
#   APP_TARGET=admin   the staff dashboard                        nginx, port $PORT or 8080
#   APP_TARGET=api     the API                                    node,  port $PORT or 4000
#
# Every service on Railway (or anywhere else) is built from this same file and differs only
# in that one variable, so there is nothing to get wrong in build settings.
#
#   docker build -t mirroractu .
#   docker run -p 8080:8080 mirroractu                          the public site
#   docker run -p 8081:8080 -e APP_TARGET=admin mirroractu      the dashboard
#   docker run -p 4000:4000 -e APP_TARGET=api -e DATABASE_URL=… mirroractu

# ---------- 1. Build the two websites ----------
FROM node:22-alpine AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# Optional build-time settings. Leave empty for house adverts only.
ARG VITE_ADSENSE_CLIENT=""
ARG VITE_ADSENSE_SLOT_LEADERBOARD=""
ARG VITE_ADSENSE_SLOT_MPU=""
ARG VITE_ADSENSE_SLOT_HALFPAGE=""
ARG VITE_ADSENSE_SLOT_INFEED=""
ARG VITE_IMA_AD_TAG=""
ARG VITE_GEO_ENDPOINT=""
# The public site's address, used by the dashboard for its "View the site" links.
ARG VITE_SITE_URL=""
ENV VITE_ADSENSE_CLIENT=$VITE_ADSENSE_CLIENT \
    VITE_ADSENSE_SLOT_LEADERBOARD=$VITE_ADSENSE_SLOT_LEADERBOARD \
    VITE_ADSENSE_SLOT_MPU=$VITE_ADSENSE_SLOT_MPU \
    VITE_ADSENSE_SLOT_HALFPAGE=$VITE_ADSENSE_SLOT_HALFPAGE \
    VITE_ADSENSE_SLOT_INFEED=$VITE_ADSENSE_SLOT_INFEED \
    VITE_IMA_AD_TAG=$VITE_IMA_AD_TAG \
    VITE_GEO_ENDPOINT=$VITE_GEO_ENDPOINT \
    VITE_SITE_URL=$VITE_SITE_URL

# Two separate builds from the same code: the public site contains no dashboard, and the
# dashboard contains no public pages (see src/lib/target.ts).
RUN npm run typecheck \
 && VITE_APP_TARGET=site  npx vite build --outDir dist-site \
 && VITE_APP_TARGET=admin npx vite build --outDir dist-admin

# ---------- 2. Build the API ----------
FROM node:22-alpine AS api-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
# The snapshot the API loads into an empty database on first start.
COPY src/data /app/src/data
RUN npm run typecheck && npm run build && npm prune --omit=dev

# ---------- 3. The image that runs ----------
# nginx as a normal (non-root) user, plus Node for the API role.
FROM nginxinc/nginx-unprivileged:1.27-alpine
USER root
RUN apk add --no-cache nodejs \
 && mkdir -p /etc/nginx/templates /opt/mirroractu/api \
 && chown -R 101:101 /etc/nginx/templates

COPY --from=web-build /app/dist-site  /usr/share/nginx/site
COPY --from=web-build /app/dist-admin /usr/share/nginx/admin
COPY deploy/nginx.site.conf.template deploy/nginx.admin.conf.template /opt/mirroractu/
COPY --from=api-build /app/server/dist         /opt/mirroractu/api/dist
COPY --from=api-build /app/server/node_modules /opt/mirroractu/api/node_modules
COPY server/package.json                       /opt/mirroractu/api/package.json
COPY server/migrations                         /opt/mirroractu/api/migrations
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh
USER 101

# APP_TARGET picks the role. API_UPSTREAM is where the two websites send /api/ requests.
ENV APP_TARGET=site \
    NODE_ENV=production \
    API_UPSTREAM=http://api:4000 \
    ADMIN_GATEWAY_KEY="" \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="^(PORT|API_UPSTREAM|ADMIN_GATEWAY_KEY|WEB_ROOT|NGINX_LOCAL_RESOLVERS)$"

EXPOSE 8080 4000
# /healthz answers in every role.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD sh -c 'case "$APP_TARGET" in api) p=${PORT:-4000};; *) p=${PORT:-8080};; esac; wget -q -O /dev/null http://127.0.0.1:$p/healthz' || exit 1
ENTRYPOINT ["/start.sh"]
