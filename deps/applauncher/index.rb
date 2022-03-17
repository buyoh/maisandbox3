# frozen_string_literal: true

require "#{__dir__}/src/launcher.rb"

if __FILE__ == $PROGRAM_NAME
  app = AppLauncher.new
  app.main
else
  warn 'index.rb is main program, so do not load this file.'
end
