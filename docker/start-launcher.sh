#!/bin/bash

set -eu

ARGS=$@

DIR_SH=`dirname $0`
DIR_TREE="$DIR_SH/../"
ADIR_TREE=`cd $DIR_TREE; pwd`

exec docker run --rm \
  -v $ADIR_TREE/deps/applauncher:/opt/msb/deps/applauncher:ro \
  -v $ADIR_TREE/var:/opt/msb/var \
  maisandbox3-launcher:default \
  /usr/bin/env ruby /opt/msb/deps/applauncher/index.rb --workdir /tmp --unixsocket /opt/msb/var/launcher.sock $ARGS
  # -e ENVNAME=value
