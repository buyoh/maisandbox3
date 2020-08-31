# frozen_string_literal: true

require 'fileutils'
require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskSetupBox
  include ALTask

  def initialize(directory_manager)
    @directory_manager = directory_manager
  end

  def validate_param(param, _local_storage)
    param = param.clone
    param.delete 'method'
  end

  def action(param, reporter, local_storage)
    validate_param param, local_storage if validation_enabled?
    sockid = local_storage[:socket_id_str]

    @directory_manager.install_user(sockid) unless @directory_manager.user_exists?(sockid)
    boxkey = @directory_manager.new_box(sockid)

    reporter.report({ success: true, result: { box: boxkey } })
    nil
  end
end
