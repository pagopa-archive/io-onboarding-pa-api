#!/usr/bin/env bash

# needed to install local deps on win32
docker run --rm -v //$PWD://usr/src/app -w //usr/src/app circleci/node:10.14.1 yarn $*
