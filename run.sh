#!/bin/bash

set -ue

subcmd=$1

if [[ x$subcmd = xbuild ]]; then
  yarn
  yarn build
elif [[ x$subcmd = xinstall ]]; then
  echo 'not implmented'
  exit 1
elif [[ x$subcmd = xrun ]]; then
  yarn start
else
  echo 'unknown subcommand: $subcmd'
fi
