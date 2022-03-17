# frozen_string_literal: true

require_relative 'al_base'
require_relative 'al_local_storage_manager'

class ALReceiver
  include ALBase

  def initialize(launcher_socket)
    super()
    @socket = launcher_socket
    @local_storage_manager = ALLocalStorageManager.new
  end

  class Reporter
    include ALBase
    def initialize(socket, id)
      @socket = socket
      @id = id
    end

    def report(result)
      @socket.responce result.merge({ id: @id })
      nil
    end
  end

  def handle(&callback)
    while (raw_line = @socket.gets)
      # NOTE: dont forget "\n"
      # note: block each line
      raw_line = raw_line.chomp
      json_line = nil
      begin
        json_line = JSON.parse(raw_line)
      rescue JSON::JSONError => e
        vlog e
        @socket.responce({ success: false, error: 'json parse error' })
      end
      next if json_line.nil?

      # idにはクエリを識別するための情報群を格納する。
      # launcherはレスポンスにそのままのidを含めて返す。
      # "id": {
      #    // クエリとレスポンスを関連付けるための識別子
      #    // 送信元が各クエリについてユニークな値を指定する
      #    "request_id": "value",
      # }
      id = json_line['id'] # task-unique
      json_line.delete 'id'

      # user_id による分類は未使用
      user_id_str = 'singleton_user'

      ls = @local_storage_manager[user_id_str]
      ls[:user_id_str] = user_id_str
      callback.call(json_line, Reporter.new(@socket, id), ls)
    end
  end
end
