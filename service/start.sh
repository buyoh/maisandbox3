#!/bin/bash

DIR_SH=`dirname $0`
DIR_TREE="$DIR_SH/../"
ADIR_TREE=`cd $DIR_TREE; pwd`

cd $ADIR_TREE

rm -rf tmp
./docker/start-launcher.sh --silent &
LAUNCHER_PROCESS=SOCKET NODE_ENV=production node build/app/MainServer.js &
