#!/bin/bash

DIR_SH=`dirname $0`
DIR_TREE="$DIR_SH/../"
ADIR_TREE=`cd $DIR_TREE; pwd`

docker run --rm \
  -v $ADIR_TREE/launcher:/opt/msb/launcher:ro \
  -v $ADIR_TREE/var:/opt/msb/var \
  maisandbox3-launcher:default \
  /usr/bin/env ruby /opt/msb/launcher/launcher.rb --workdir /tmp --unixsocket /opt/msb/var/launcher.sock
  # -e ENVNAME=value
