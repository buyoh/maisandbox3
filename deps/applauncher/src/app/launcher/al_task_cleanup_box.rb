# frozen_string_literal: true

require 'fileutils'
require_relative 'al_task'

class ALTaskCleanupBox
  include ALTask

  def initialize(box)
    @box = box
  end

  def self.from_json(param)
    box = param['box']
    return nil unless (box.is_a? String) && !box.empty?

    new(box)
  end

  # def validate_param(param, _local_storage)
  #   param = param.clone
  #   param.delete 'method'
  #   abort 'ALTaskCleanupBox: validation failed: box' if param['box'].nil?
  #   param.delete 'box'
  #   abort 'ALTaskExec: validation failed: extra values' unless param.empty?
  # end

  def action(reporter, local_storage, directory_manager)
    # validate_param param, local_storage if validation_enabled?s
    user_id = local_storage[:user_id_str]
    if @box.nil?
      report_failed reporter, 'param invalid'
      return nil
    end

    if directory_manager.user_exists?(user_id) && directory_manager.box_exists?(user_id, @box)
      directory_manager.delete_box(user_id, @box)
    end

    reporter.report({ success: true })
    nil
  end
end
