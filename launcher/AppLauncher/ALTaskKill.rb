# frozen_string_literal: true

require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskKill
  include ALTask

  def validate_param(param, _local_storage)
    param = param.clone
    param.delete 'method'
  end

  def action(param, reporter, local_storage)
    validate_param param, local_storage if validation_enabled?
    if !local_storage.key?(:pid) || local_storage[:pid].nil?
      vlog 'do_kill: no action'
      reporter.report({ success: true, continue: true, result: { accepted: false } })
      return nil
    end
    pid = local_storage[:pid]
    Executor.kill pid
    vlog "do_kill: kill pid=#{pid}"
    reporter.report({ success: true, continue: true, result: { accepted: true } })
  end
end
