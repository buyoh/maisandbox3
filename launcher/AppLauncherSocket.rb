# frozen_string_literal: true

require_relative 'AppLauncherBase.rb'

class AppLauncherSocket
  include AppLauncherBase
  def initialize(input, output)
    @input = input
    @output = output
    @mutex_input = Mutex.new
    @mutex_output = Mutex.new
  end

  attr_reader :input, :output

  def gets
    unless @mutex_input.try_lock
      vlog 'warning: AppLauncherSocket#gets may be called from some threads!'
      return nil
    end
    line = input.gets
    @mutex_input.unlock
    line
  end

  def puts(str)
    s = str.to_s
    @mutex_output.synchronize do
      STDOUT.puts s
      STDOUT.flush
    end
  end

  def responce(data)
    puts JSON.generate(data)
  end
end
