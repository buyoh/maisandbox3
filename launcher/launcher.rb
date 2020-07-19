# frozen_string_literal: true

# 適切な権限に変更して実行する人
# docker上を仮定(後で)
# ファイル転送はなし。dockerのボリュームマッピングを使う。
# 実行だけdocker上から行う。
# interactiveは後で追加。

require 'json'
require_relative 'AppLauncherBase.rb'
require_relative 'AppLauncherTask.rb'
require_relative 'AppLauncherReciever.rb'

class AppLauncher
  include AppLauncherBase

  def main
    trap(:INT) do
      STDERR.puts 'SIGINT'
      exit
    end
    reciever = AppLauncherReciever.new

    reciever.handle do |json_line, reporter|
      case json_line['method']
      when 'store'
        task = AppLauncherTask.new
        task.do_store(json_line, reporter)
      when 'exec'
        task = AppLauncherTask.new
        task.do_exec(json_line, reporter)
      else
        vlog "unknown method: #{json_line['method']}"
        reporter.report({ success: false, error: 'unknown method' })
      end
    end
  end
end

app = AppLauncher.new
app.main
