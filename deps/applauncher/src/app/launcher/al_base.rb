# frozen_string_literal: true

require 'json'

module ALBase
  @@mutex_stderr = Mutex.new
  @@verbose = 0 # [-1, 0, 1]
  @@validate = false
  @@superuser = false # currently unused

  module_function

  def update_verbose(verbose)
    @@verbose = verbose
  end

  def update_validate(validate)
    @@validate = validate
  end

  def validation_enabled?
    @@validate
  end

  def vlog(str)
    return unless @@verbose >= 1

    @@mutex_stderr.synchronize do
      warn str
    end
  end

  def wlog(str)
    return unless @@verbose >= 0

    @@mutex_stderr.synchronize do
      warn str
    end
  end
end
