#!/bin/bash

cd "$(dirname "$0")/../../.."

if [[ $NODE_ENV == "production" ]]; then
  npm run build
  npm prune --production
  ruby deps/applauncher/index.rb --verbose &
  LAUNCHER_PROCESS=SOCKET timeout 20 npm run prod || [[ $? -eq 124 ]]
else
  PORT=3030 timeout 10 npm run dev || [[ $? -eq 124 ]]
fi
