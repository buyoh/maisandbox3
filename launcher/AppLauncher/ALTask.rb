# frozen_string_literal: true

require_relative '../lib/Executor'
require_relative 'ALBase'

module ALTask
  include ALBase

  def report_failed(reporter, err)
    reporter.report({ success: false, error: err })
  end
end

require_relative 'ALTaskExec'
require_relative 'ALTaskKill'
require_relative 'ALTaskStore'
