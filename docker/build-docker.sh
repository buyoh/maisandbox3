#!/bin/bash

set -eu

DIR_SH=`dirname $0`

docker build $DIR_SH/base -t maisandbox3-launcher:default
