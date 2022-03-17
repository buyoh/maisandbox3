#!/bin/bash

set -eu

bundle exec rubocop --auto-correct
bundle exec steep check
bundle exec rspec
bundle exec typeprof src/launcher.rb -o log/launcher.rbs
