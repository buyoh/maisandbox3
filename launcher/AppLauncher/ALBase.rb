# frozen_string_literal: true

require 'json'

module ALBase
  @@mutex_stderr = Mutex.new
  @@verbose = 0
  @@validate = false
  @@superuser = false
  @@work_directory = __dir__ + '/../../tmp'

  module_function

  def update_verbose(verbose)
    @@verbose = verbose
  end

  def update_validate(_validate)
    @@validate = true
  end

  def validation_enabled?
    @@validate
  end

  def work_directory
    @@work_directory
  end

  def update_work_directory(path)
    @@work_directory = path
  end

  def vlog(str)
    return unless @@verbose >= 1

    @@mutex_stderr.synchronize do
      STDERR.puts str
    end
  end

  def wlog(str)
    return unless @@verbose >= 0

    @@mutex_stderr.synchronize do
      STDERR.puts str
    end
  end
end
