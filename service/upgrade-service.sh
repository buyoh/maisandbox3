#!/bin/bash

set -eu

DIR_SH=`dirname $0`
DIR_TREE="$DIR_SH/.."
DIR_WORK=/opt/maisandbox3

mkdir -p $DIR_WORK
if [[ ! -w $DIR_WORK ]]; then
  echo "Permission denied: $DIR_WORK"
  exit 1
fi

sudo systemctl stop maisandbox3

rsync -a $DIR_TREE/* $DIR_WORK/ \
  --exclude "tmp" --exclude "var"

pushd $DIR_WORK
npx yarn build
npx yarn --production  # erase development dependencies
popd

docker/build-docker.sh 

sudo systemctl start maisandbox3

echo "##### complete upgrade-service #####"
