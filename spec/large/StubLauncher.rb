# frozen_string_literal: true

require_root 'launcher/AppLauncher/ALBase'
require_root 'launcher/AppLauncher/ALTask'
require_root 'launcher/AppLauncher/ALSocket'
require_root 'launcher/AppLauncher/ALReciever'
require_root 'launcher/AppLauncher/ALAllTasks'

class StubLauncher
  include ALBase

  def initialize
    @iwr, @iww = IO.pipe
    @irr, @irw = IO.pipe
  end

  def writer
    @iww
  end

  def reader
    @irr
  end

  def main
    # socket = ALSocket.new(STDIN, STDOUT)
    socket = ALSocket.new(@iwr, @irw)

    reciever = ALReciever.new(socket)

    reciever.handle do |json_line, reporter, local_storage|
      # note: ノンブロッキングで書く必要がある。TaskStoreがかなり怪しいが
      # ノンブロッキングで書くか、thread + chdir禁止か。forkはメモリを簡単に共有出来ないのでNG
      case json_line['method']
      when 'store'
        task = ALTaskStore.new
        task.action(json_line, reporter, local_storage)
      when 'exec'
        task = ALTaskExec.new
        task.action(json_line, reporter, local_storage)
      when 'kill'
        task = ALTaskKill.new
        task.action(json_line, reporter, local_storage)
      else
        reporter.report({ success: false, error: 'unknown method' })
      end
    end
  end

  def close
    [@iwr, @iww, @irr, @irw].each(&:close)
  end
end
