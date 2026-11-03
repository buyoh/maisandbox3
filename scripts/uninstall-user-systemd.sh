#!/bin/bash

set -eu

DIR_SH=$(dirname $0)
DIR_TREE=$(realpath "$DIR_SH/..")
DIR_TARGET_LIB=$HOME/.local/lib/maisandbox3
DIR_TARGET_SYSTEMD=$HOME/.config/systemd/user

systemctl --user stop maisandbox3 || true
systemctl --user disable maisandbox3 || true
rm -f "$DIR_TARGET_SYSTEMD/maisandbox3.service"
systemctl --user daemon-reload

# sys タグの docker image は削除する
docker rmi maisandbox3-web:sys || true
docker rmi maisandbox3-runner:sys || true

rm -rf "$DIR_TARGET_LIB"
echo "##### complete uninstall #####"
