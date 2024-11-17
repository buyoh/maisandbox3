#!/bin/bash

cd "$(dirname "$0")/../../.."

if [[ $NODE_ENV == "production" ]]; then
  yarn build
  # yarn --production
  RUN yarn workspaces focus --all --production  # yarn v2
  ruby deps/applauncher/index.rb --verbose &
  LAUNCHER_PROCESS=SOCKET timeout 20 yarn prod || [[ $? -eq 124 ]]
else
  PORT=3030 timeout 10 yarn dev || [[ $? -eq 124 ]]
fi
