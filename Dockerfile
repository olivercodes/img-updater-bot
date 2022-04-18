# build
FROM bitnami/node:14.19.1 as build-stage
USER root 
WORKDIR /usr
COPY app/ ./
RUN npm install --unsafe-perm && npm run build
RUN npm prune --production

# prod
FROM bitnami/node:14.19.1 as production-stage
USER root
WORKDIR /usr
COPY --from=build-stage --chown=node:node /usr .
COPY docker-entrypoint.sh /usr/local/bin
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER 1000

ENTRYPOINT ["docker-entrypoint.sh"]


