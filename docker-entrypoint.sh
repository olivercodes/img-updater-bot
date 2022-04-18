#!/bin/sh
ls -a
cd /usr

# start
echo "docker-entry, starting up node service"
npm run start:prod
