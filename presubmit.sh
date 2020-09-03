#!/bin/bash

set -eu

yarn lint-fix
bundle exec rubocop --auto-correct

yarn test
bundle exec rspec
