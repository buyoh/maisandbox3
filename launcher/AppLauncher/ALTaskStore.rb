# frozen_string_literal: true

require 'fileutils'
require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskStore
  include ALTask

  def check_valid_filequery(files)
    files.none? do |file|
      path = file['path']
      data = file['data']
      path.nil? || data.empty? || path.start_with?('/') || path.include?('..')
    end
  end
  private :check_valid_filequery

  def action(param, reporter, local_storage)
    files = param['files']
    if files.nil? || !files.is_a?(Array)
      report_failed reporter, 'invalid arguments'
      return nil
    end

    # check param
    unless check_valid_filequery(files)
      report_failed reporter, 'invalid files'
      return nil
    end

    ls_chdir = work_directory + '/' + local_storage[:job_id_str]
    FileUtils.mkdir_p ls_chdir

    # work
    files.each do |file|
      path = file['path']
      data = file['data']
      IO.write(ls_chdir + '/' + path, data)
    end
    reporter.report({ success: true })
    nil
  end
end
