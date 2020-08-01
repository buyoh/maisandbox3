# frozen_string_literal: true

require_relative 'ALBase'
require_relative 'ALLocalStorageManager'

class ALReciever
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

      # json.idを失わないようにALRecieverで管理する
      # ALRecieverの重要な役割のひとつ
      id = json_line['id'] # task-unique
      vlog id
      id_str = JSON.generate(id).hash.to_s(36)
      job_id = json_line['id']['jid'] # task_list-unique
      job_id_str = JSON.generate(job_id).hash.to_s(36)
      # socket_id = json_line['id']['sid'] # socket-user-unique
      # TODO: 削除しないと貯まる まじで
      ls = @local_storage_manager[job_id_str]
      ls[:id_str] = id_str
      ls[:job_id_str] = job_id_str
      callback.call(json_line, Reporter.new(@socket, id), ls)
    end
  end
end
