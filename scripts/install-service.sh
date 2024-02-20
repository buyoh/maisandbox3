#!/bin/bash

set -eu

DIR_SH=$(dirname $0)
DIR_TREE=$(realpath "$DIR_SH/..")
DIR_WORK=/opt/maisandbox3

# Build docker compose image
cd $DIR_TREE/docker
docker compose build

# Install systemd service
mkdir -p $DIR_WORK
rm -rf $DIR_WORK
mkdir -p $DIR_WORK
rsync -a $DIR_TREE/docker $DIR_WORK/

cat <<EOS > /etc/systemd/system/maisandbox3.service
[Unit]
Description = maisandbox3
[Service]
WorkingDirectory = $DIR_WORK/docker
ExecStart = docker compose up
Restart = no
# Type = forking
Type = simple
[Install]
WantedBy = multi-user.target
EOS

sudo systemctl daemon-reload
sudo systemctl enable maisandbox3
sudo systemctl start maisandbox3

echo "##### complete install-service #####"
