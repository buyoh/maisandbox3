#!/bin/bash

DIR_SH=`dirname $0`

cd $DIR_SH/..
NODE_ENV=production node build/app/MainServer.js