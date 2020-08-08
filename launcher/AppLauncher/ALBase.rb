# frozen_string_literal: true

require 'json'

module ALBase
  @@mutex_stderr = Mutex.new
  @@verbose = true
  @@superuser = false
  @@work_directory = __dir__ + '/../../tmp'

  module_function

  def work_directory
    @@work_directory
  end

  def work_directory=(path)
    @@work_directory = path
  end

  def vlog(str)
    return unless @@verbose

    @@mutex_stderr.synchronize do
      STDERR.puts str
    end
  end
end
