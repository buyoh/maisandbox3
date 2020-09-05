#!/bin/bash

set -eu

DIR_SH=`dirname $0`
DIR_TREE="$DIR_SH/.."
DIR_WORK=/opt/maisandbox3

mkdir -p $DIR_WORK
rsync -a $DIR_TREE/* $DIR_WORK/ \
  --exclude "tmp" --exclude "var"

pushd $DIR_WORK
npx yarn build
npx yarn --production  # erase development dependencies
popd

docker/build-docker.sh 

cat <<EOS > /etc/systemd/system/maisandbox3.service
[Unit]
Description = maisandbox3
[Service]
ExecStart = $DIR_WORK/service/start.sh
Restart = no
Type = forking
[Install]
WantedBy = multi-user.target
EOS

sudo systemctl daemon-reload
sudo systemctl enable maisandbox3
sudo systemctl start maisandbox3

echo "##### complete install-service #####"
