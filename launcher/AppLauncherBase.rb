# frozen_string_literal: true

require 'json'

module AppLauncherBase
  @@mutex_stderr = Mutex.new
  @@mutex_printer = Mutex.new
  @@verbose = true
  @@superuser = false

  module_function

  def vlog(str)
    if @@verbose
      @@mutex_stderr.synchronize do
        STDERR.puts str
      end
    end
  end

  def responce(data)
    j = JSON.generate(data)
    @@mutex_printer.synchronize do
      STDOUT.puts j
      STDOUT.flush
    end
  end
end
