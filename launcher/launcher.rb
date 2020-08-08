# frozen_string_literal: true

# 適切な権限に変更して実行する人

require 'fileutils'
require 'json'
require 'socket'
require 'optparse'
require_relative 'AppLauncher/ALBase'
require_relative 'AppLauncher/ALTask'
require_relative 'AppLauncher/ALSocket'
require_relative 'AppLauncher/ALReciever'

require_relative 'AppLauncher/ALAllTasks'

class AppLauncher
  include ALBase

  def initialize
    @config = { ipc: :stdio, loop: false, sockpath: nil }
    opts = OptionParser.new
    opts.on('--stdio') { @config[:ipc] = :stdio }
    opts.on('--unixsocket path') do |path|
      @config[:ipc] = :unix
      @config[:sockpath] = path
    end
    opts.on('--workdir path') do |path|
      FileUtils.mkdir_p path  unless Dir.exist?(path)
      work_directory = path
    end
    opts.on('--verbose') do
      set_verbose 1
    end
    opts.on('--quiet') do
      set_verbose 0
    end
    opts.on('--silent') do
      set_verbose(-1)
    end
    opts.on('--loop') { @config[:loop] = true }
    opts.parse!(ARGV)
  end

  def main
    case @config[:ipc]
    when :stdio
    when :unix
      File.unlink @config[:sockpath] if File.exist? @config[:sockpath]
      @unix_server = UNIXServer.new(@config[:sockpath])
      system "chmod 666 #{@config[:sockpath]}"
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
        # note: ノンブロッキングで書く必要がある。TaskStoreがかなり怪しいが
        # ノンブロッキングで書くか、thread + chdir禁止か。forkはメモリを簡単に共有出来ないのでNG
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
          wlog "unknown method: #{json_line['method']}"
          reporter.report({ success: false, error: 'unknown method' })
        end
      end

      case @config[:ipc]
      when :unix
        unix_socket.close
      end

      break unless @config[:loop]
    end
  end
end

app = AppLauncher.new
app.main
