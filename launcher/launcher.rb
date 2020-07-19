# frozen_string_literal: true

# 適切な権限に変更して実行する人
# docker上を仮定(後で)
# ファイル転送はなし。dockerのボリュームマッピングを使う。
# 実行だけdocker上から行う。
# interactiveは後で追加。

require 'json'
require_relative 'AppLauncherBase.rb'
require_relative 'AppLauncherTask.rb'
require_relative 'AppLauncherHandler.rb'

class AppLauncher
  include AppLauncherBase

  def main
    trap(:INT) do
      STDERR.puts 'SIGINT'
      exit
    end
    handler = AppLauncherHandler.new

    handler.handle do |json_line|
      case json_line['method']
      when 'store'
        task = AppLauncherTask.new
        next task.do_store(json_line)
      when 'exec'
        task = AppLauncherTask.new
        next task.do_exec(json_line)
      else
        vlog "unknown method: #{json_line['method']}"
        next { success: false, error: 'unknown method' }
      end
    end
  end
end

app = AppLauncher.new
app.main
