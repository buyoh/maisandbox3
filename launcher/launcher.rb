# frozen_string_literal: true

# 適切な権限に変更して実行する人
# docker上を仮定(後で)
# ファイル転送はなし。dockerのボリュームマッピングを使う。
# 実行だけdocker上から行う。
# interactiveは後で追加。

require 'json'
require_relative 'AppLauncher/ALBase'
require_relative 'AppLauncher/ALTask'
require_relative 'AppLauncher/ALSocket'
require_relative 'AppLauncher/ALReciever'

class AppLauncher
  include ALBase

  def main
    trap(:INT) do
      STDERR.puts 'SIGINT'
      exit
    end
    socket = ALSocket.new(STDIN, STDOUT)
    reciever = ALReciever.new(socket)

    reciever.handle do |json_line, reporter, local_storage|
      case json_line['method']
      when 'store'
        task = ALTask.new
        task.do_store(json_line, reporter, local_storage)
      when 'exec'
        task = ALTask.new
        task.do_exec(json_line, reporter, local_storage)
      when 'kill'
        task = ALTask.new
        task.do_kill(json_line, reporter, local_storage)
      else
        vlog "unknown method: #{json_line['method']}"
        reporter.report({ success: false, error: 'unknown method' })
      end
    end
  end
end

app = AppLauncher.new
app.main
