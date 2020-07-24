# frozen_string_literal: true

require_relative 'AppLauncherBase'
require_relative 'AppLauncherLocalStorageManager'

class AppLauncherReciever
  include AppLauncherBase

  def initialize(launcher_socket)
    super()
    @socket = launcher_socket
    @local_storage_manager = AppLauncherLocalStorageManager.new
  end

  class Reporter
    include AppLauncherBase
    def initialize(socket, id)
      @socket = socket
      @id = id
    end

    def report(result)
      @socket.responce result.merge({ id: @id })
    end
  end

  def handle(&callback)
    while raw_line = @socket.gets
      # note: dont forget "\n"
      # note: block each line
      raw_line = raw_line.chomp
      json_line = nil
      begin
        json_line = JSON.parse(raw_line)
      rescue JSON::JSONError => e
        vlog e
        responce({ success: false, error: 'json parse error' })
      end
      next if json_line.nil?

      # json.idを失わないようにAppLauncherRecieverで管理する
      # AppLauncherRecieverの重要な役割のひとつ
      id = json_line['id']
      id_str = JSON.generate(id)
      # TODO: 削除しないと貯まる
      # TODO: 無視したいが、攻撃によってidが滅茶苦茶長くなった場合に死ぬ(node側で処理したい)
      ls = @local_storage_manager[id_str]
      callback.call(json_line, Reporter.new(@socket, id), ls)
    end
  end
end
