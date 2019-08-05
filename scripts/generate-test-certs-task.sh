#!/usr/bin/env bash

docker run --rm -v "$PWD:/usr/src/app" -e "NODE_ENV=development" -w "/usr/src/app/certs" circleci/node:10.14.1 yarn generate:test-certs
