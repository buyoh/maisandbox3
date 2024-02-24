#!/bin/bash

set -eu

DIR_SH=$(dirname $0)
DIR_TREE=$(realpath "$DIR_SH/..")
DIR_WORK=/opt/maisandbox3

sudo systemctl stop maisandbox3

pushd $DIR_WORK
pushd docker
docker compose down --rmi all --volumes --remove-orphans
docker compose rm -v -a
popd
popd

rm -f /etc/systemd/system/maisandbox3.service
rm -rf $DIR_WORK
sudo systemctl daemon-reload

echo "##### complete uninstall #####"
