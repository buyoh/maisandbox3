# frozen_string_literal: true

require_relative 'AppLauncherBase.rb'

class AppLauncherReciever
  include AppLauncherBase

  class Reporter
    include AppLauncherBase
    def initialize(id)
      @id = id
    end

    def report(result)
      responce result.merge({ id: @id })
    end
  end

  def handle(&callback)
    while raw_line = STDIN.gets
      # note: dont forget "\n"
      # note: block each line
      vlog "recv: #{raw_line}"
      json_line = nil
      begin
        json_line = JSON.parse(raw_line)
      rescue JSON::JSONError => e
        vlog e
        responce({ success: false, error: 'json parse error' })
      end
      next if json_line.nil?

      id = json_line['id']
      callback.call(json_line, Reporter.new(id))
    end
  end
end
