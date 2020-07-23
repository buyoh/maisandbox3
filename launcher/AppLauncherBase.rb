# frozen_string_literal: true

require 'json'

module AppLauncherBase
  @@mutex_stderr = Mutex.new
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
end
