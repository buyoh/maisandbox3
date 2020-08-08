# frozen_string_literal: true

require 'json'

module ALBase
  @@mutex_stderr = Mutex.new
  @@verbose = 0
  @@silent = false
  @@superuser = false
  @@work_directory = __dir__ + '/../../tmp'

  module_function

  def set_verbose(v)
    @@verbose = v
  end

  def work_directory
    @@work_directory
  end

  def work_directory=(path)
    @@work_directory = path
  end

  def vlog(str)
    return unless 1 <= @@verbose

    @@mutex_stderr.synchronize do
      STDERR.puts str
    end
  end

  def wlog(str)
    return unless 0 <= @@silent

    @@mutex_stderr.synchronize do
      STDERR.puts str
    end
  end
end
