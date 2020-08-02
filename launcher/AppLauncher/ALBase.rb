# frozen_string_literal: true

require 'json'

module ALBase
  @@mutex_stderr = Mutex.new
  @@verbose = true
  @@superuser = false
  @@work_directory = __dir__ + '/../../var'

  module_function

  def work_directory
    @@work_directory
  end

  def vlog(str)
    if @@verbose
      @@mutex_stderr.synchronize do
        STDERR.puts str
      end
    end
  end
end
