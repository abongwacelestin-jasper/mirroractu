#!/bin/sh
# Starts one MirrorActu container in the role named by APP_TARGET: site, admin or api.
set -e

role="${APP_TARGET:-site}"
echo "MirrorActu starting as: $role"

case "$role" in
  api)
    export PORT="${PORT:-4000}"
    cd /opt/mirroractu/api
    exec node dist/index.js
    ;;
  site|admin)
    export PORT="${PORT:-8080}"
    export WEB_ROOT="/usr/share/nginx/$role"
    # The nginx image turns this template into its config, filling in PORT, API_UPSTREAM and the rest.
    cp "/opt/mirroractu/nginx.$role.conf.template" /etc/nginx/templates/default.conf.template
    exec /docker-entrypoint.sh nginx -g 'daemon off;'
    ;;
  *)
    echo "APP_TARGET must be site, admin or api (got '$role')." >&2
    exit 1
    ;;
esac
