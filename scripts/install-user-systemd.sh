#!/bin/bash

set -eu

DIR_SH=$(dirname $0)
DIR_TREE=$(realpath "$DIR_SH/..")
DIR_TARGET_LIB=$HOME/.local/lib/maisandbox3
DIR_TARGET_SYSTEMD=$HOME/.config/systemd/user

if [ ! -d "$DIR_TARGET_SYSTEMD" ]; then
  echo "mkdir -p $DIR_TARGET_SYSTEMD"
  mkdir -p "$DIR_TARGET_SYSTEMD"
fi

# 1. 今の環境で docker compose build をする
# 2. latest タグが付いているので、これに sys タグを付ける。systemd のサービスからは sys タグのイメージを使うようにする。
# 3. docker-compose.yml 等の実行に必要なファイルを $HOME/.local/lib/maisandbox3 にコピーする
#  nodejs や go のバイナリはすべて docker image 内にあるので、今はdocker-compose.yml のみとなる。
# 4. $HOME/.config/systemd/user/maisandbox3.service を作る

# 5. systemctl --user enable maisandbox3.service
# 6. systemctl --user start maisandbox3.service

# 1. docker compose build
cd "$DIR_TREE/docker"
docker compose build

# 2. latest タグが付いているので、これに sys タグを付ける。systemd のサービスからは sys タグのイメージを使うようにする。
docker tag maisandbox3-web:latest maisandbox3-web:sys
docker tag maisandbox3-runner:latest maisandbox3-runner:sys

# 3. docker-compose.yml 等の実行に必要なファイルを $HOME/.local/lib/maisandbox3 にコピーする
# TODO: cleanup old files?
mkdir -p "$DIR_TARGET_LIB"
cp "$DIR_TREE/docker/docker-compose.yml" "$DIR_TARGET_LIB/"

# 4. $HOME/.config/systemd/user/maisandbox3.service を作る
cat <<EOS > "$DIR_TARGET_SYSTEMD/maisandbox3.service"
[Unit]
Description = maisandbox3
[Service]
WorkingDirectory = $DIR_TARGET_LIB
ExecStartPre = docker compose down
ExecStart = docker compose up
ExecStop = docker compose down
Restart = no
Type = simple
[Install]
WantedBy = default.target
EOS

systemctl --user daemon-reload
systemctl --user enable maisandbox3
systemctl --user start maisandbox3

echo "##### complete install #####"