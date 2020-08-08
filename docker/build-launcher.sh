#!/bin/bash

DIR_SH=`dirname $0`

docker build $DIR_SH/launcher -t maisandbox3-launcher:default
