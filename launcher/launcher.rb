# frozen_string_literal: true

# 適切な権限に変更して実行する人

require 'json'
require 'socket'
require 'optparse'
require_relative 'AppLauncher/ALBase'
require_relative 'AppLauncher/ALTask'
require_relative 'AppLauncher/ALSocket'
require_relative 'AppLauncher/ALReciever'

class AppLauncher
  include ALBase

  def initialize
    @config = { ipc: :stdio, loop: false, sockpath: nil }
    opts = OptionParser.new
    opts.on('--stdio') { @config[:ipc] = :stdio }
    opts.on('--unixsocket path') { |path| @config[:ipc] = :unix; @config[:sockpath] = path }
    opts.on('--loop') { @config[:loop] = true }
    opts.parse!(ARGV)
  end

  def main
    case @config[:ipc]
    when :stdio
    when :unix
      File.unlink @config[:sockpath] if File.exist? @config[:sockpath]
      @unix_server = UNIXServer.new(@config[:sockpath])
    else
      abort "unknown ipc config: #{@config[:ipc]}"
    end

    trap(:INT) do
      STDERR.puts 'SIGINT'
      @unix_server&.close
      exit
    end

    loop do
      case @config[:ipc]
      when :stdio
        socket = ALSocket.new(STDIN, STDOUT)
      when :unix
        unix_socket = @unix_server.accept
        socket = ALSocket.new(unix_socket, unix_socket)
      end

      reciever = ALReciever.new(socket)

      reciever.handle do |json_line, reporter, local_storage|
        case json_line['method']
        when 'store'
          task = ALTaskStore.new
          task.action(json_line, reporter, local_storage)
        when 'exec'
          task = ALTaskExec.new
          task.action(json_line, reporter, local_storage)
        when 'kill'
          task = ALTaskKill.new
          task.action(json_line, reporter, local_storage)
        else
          vlog "unknown method: #{json_line['method']}"
          reporter.report({ success: false, error: 'unknown method' })
        end
      end

      case @config[:ipc]
      when :stdio
      when :unix
        unix_socket.close
      end

      break unless @config[:loop]
    end
  end
end

app = AppLauncher.new
app.main
