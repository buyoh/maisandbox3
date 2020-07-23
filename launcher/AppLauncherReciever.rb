# frozen_string_literal: true

require_relative 'AppLauncherBase.rb'

class AppLauncherReciever
  include AppLauncherBase

  def initialize(launcher_socket)
    super()
    @socket = launcher_socket
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

      id = json_line['id']
      callback.call(json_line, Reporter.new(@socket, id))
    end
  end
end
