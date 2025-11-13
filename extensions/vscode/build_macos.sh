#!/usr/bin/env bash
#curl -L -o /tmp/node-v20.19.0-darwin-arm64.tar.gz https://nodejs.org/dist/v20.19.0/node-v20.19.0-darwin-arm64.tar.gz
#tar -xzf /tmp/node-v20.19.0-darwin-arm64.tar.gz -C /tmp
#./scripts/install-dependencies.sh
PATH=/tmp/node-v20.19.0-darwin-arm64/bin:$PATH SKIP_INSTALLS=true npm run package

