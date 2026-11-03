#!/bin/bash

set -eu

DIR_SH=$(dirname $0)
DIR_TREE=$(realpath "$DIR_SH/..")
DIR_WORK=/opt/maisandbox3

SYSTEMD_FILE_EXISTS=$([ -f /etc/systemd/system/maisandbox3.service ] && echo "true" || echo "false")
INSTALL_DIR_EXISTS=$([ -d $DIR_WORK ] && echo "true" || echo "false")

echo "Note: this script is for uninstalling the OLD maisandbox3 service."
echo "Systemd file exists: $SYSTEMD_FILE_EXISTS"
echo "Install dir exists: $INSTALL_DIR_EXISTS"

if [ "$SYSTEMD_FILE_EXISTS" == "false" ] && [ "$INSTALL_DIR_EXISTS" == "false" ]; then
    echo "##### nothing to uninstall #####"
    exit 0
fi

if [ "$SYSTEMD_FILE_EXISTS" == "false" ] || [ "$INSTALL_DIR_EXISTS" == "false" ]; then
    echo "##### error: systemd file and install dir must both exist or both not exist #####"
    exit 1
fi

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
