# frozen_string_literal: true

require_relative 'al_task_exec'
require_relative 'al_task_exec_fileio'
require_relative 'al_task_kill'
require_relative 'al_task_store'
require_relative 'al_task_pull'
require_relative 'al_task_setup_box'
require_relative 'al_task_cleanup_box'

module ALTaskFactory
  def self.from_json(param)
    case param['method']
    when 'setupbox'
      return ALTaskSetupBox.from_json param
    when 'cleanupbox'
      return ALTaskCleanupBox.from_json param
    when 'store'
      return ALTaskStore.from_json param
    when 'pull'
      return ALTaskPull.from_json param
    when 'exec'
      return ALTaskExec.from_json param
    when 'execfileio'
      return ALTaskExecFileIO.from_json param
    when 'kill'
      return ALTaskKill.from_json param
    end
    nil
  end
end
