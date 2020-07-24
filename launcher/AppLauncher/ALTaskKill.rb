# frozen_string_literal: true

require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskKill
  include ALTask

  def action(_param, reporter, local_storage)
    if !local_storage.key?(:pid) || local_storage[:pid].nil?
      vlog 'do_kill: no action'
      reporter.report({ success: true, continue: true, result: { send: false } })
      return nil
    end
    pid = local_storage[:pid]
    Executor.kill pid
    vlog "do_kill: kill pid=#{pid}"
    reporter.report({ success: true, continue: true, result: { send: true } })
  end
end
