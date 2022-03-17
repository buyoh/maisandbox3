# frozen_string_literal: true

require 'tmpdir'
require_root 'app/launcher/al_base.rb'
require_root 'app/launcher/al_task.rb'
require_root 'app/launcher/al_socket.rb'
require_root 'app/launcher/al_receiver.rb'
require_root 'lib/directory_manager/directory_manager.rb'
require_root 'app/launcher/al_task_factory.rb'

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
    update_verbose(1)
    update_validate true
    # socket = ALSocket.new(STDIN, STDOUT)
    socket = ALSocket.new(@iwr, @irw)

    Dir.mktmpdir do |tmpdir|
      directory_manager = DirectoryManager.new(tmpdir)
      receiver = ALReceiver.new(socket)

      receiver.handle do |json_line, reporter, local_storage|
        # NOTE: ノンブロッキングで書く必要がある。TaskStoreがかなり怪しいが
        # ノンブロッキングで書くか、thread + chdir禁止か。forkはメモリを簡単に共有出来ないのでNG
        task = ALTaskFactory.from_json json_line
        if task
          task.action(reporter, local_storage, directory_manager)
        else
          reporter.report({ success: false, error: 'unknown method' })
        end
      end
    end
  end

  def close
    [@iwr, @iww, @irr, @irw].each(&:close)
  end
end
