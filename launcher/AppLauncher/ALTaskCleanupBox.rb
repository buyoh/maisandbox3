# frozen_string_literal: true

require 'fileutils'
require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskCleanupBox
  include ALTask

  def initialize(directory_manager)
    @directory_manager = directory_manager
  end

  def validate_param(param, _local_storage)
    param = param.clone
    param.delete 'method'
    abort 'ALTaskCleanupBox: validation failed: box' if param['box'].nil?
    param.delete 'box'
    abort 'ALTaskExec: validation failed: extra values' unless param.empty?
  end

  def action(param, reporter, local_storage)
    validate_param param, local_storage if validation_enabled?
    sockid = local_storage[:socket_id_str]
    box = param['box']
    if box.nil?
      report_failed reporter, 'param invalid'
      return nil
    end

    if @directory_manager.user_exists?(sockid) && @directory_manager.box_exists?(sockid, box)
      @directory_manager.delete_box(sockid, box)
    end

    reporter.report({ success: true })
    nil
  end
end
