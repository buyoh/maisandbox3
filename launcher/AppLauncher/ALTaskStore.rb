# frozen_string_literal: true

require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskStore
  include ALTask

  def action(param, reporter, _local_storage)
    files = param['files']
    if files.nil? || !files.is_a?(Array)
      report_failed reporter, 'invalid arguments'
      return nil
    end

    # check param
    if files.any? do |file|
         path = file['path']
         data = file['data']
         path.nil? || data.empty? || path.start_with?('/') || path.include?('..')
       end
      report_failed reporter, 'invalid arguments'
      return nil
    end

    # work
    files.each do |file|
      path = file['path']
      data = file['data']
      IO.write(path, data)
    end
    reporter.report({ success: true })
    nil
  end
end
