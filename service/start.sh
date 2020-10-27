#!/bin/bash

DIR_SH=`dirname $0`
DIR_TREE="$DIR_SH/../"
ADIR_TREE=`cd $DIR_TREE; pwd`

cd $ADIR_TREE

cd docker
exec docker-compose up

# note: legacy impl without docker-compose
# rm -rf tmp
# ./docker/start-launcher.sh --silent &
# LAUNCHER_PROCESS=SOCKET NODE_ENV=production node build/app/MainServer.js &
