# frozen_string_literal: true

# 適切な権限に変更して実行する人

require 'fileutils'
require 'json'
require 'socket'
require 'optparse'
require_relative 'app/launcher/al_base'
require_relative 'app/launcher/al_task'
require_relative 'app/launcher/al_socket'
require_relative 'app/launcher/al_receiver'
require_relative 'lib/directory_manager/directory_manager'

require_relative 'app/launcher/al_task_factory'

class AppLauncher
  include ALBase

  def initialize
    @config = { ipc: :stdio, loop: false, sockpath: nil, work_dir: "#{Dir.pwd}/tmp" }
    opts = OptionParser.new
    opts.on('--stdio') { @config[:ipc] = :stdio }
    opts.on('--unixsocket path') do |path|
      @config[:ipc] = :unix
      @config[:sockpath] = path
    end
    opts.on('--workdir path') do |path|
      FileUtils.mkdir_p path unless Dir.exist?(path)
      @config[:work_dir] = path
    end
    opts.on('--verbose') do
      update_verbose 1
    end
    opts.on('--quiet') do
      update_verbose 0
    end
    opts.on('--silent') do
      update_verbose(-1)
    end
    opts.on('--loop') { @config[:loop] = true }
    opts.on('--validate') do
      # validate input-output
      update_validate true
    end
    opts.parse!(ARGV)
  end

  def main
    case @config[:ipc]
    when :stdio
    when :unix
      # NOTE: sp always String.
      # @type var sp: untyped
      sp = @config[:sockpath]
      File.unlink sp if sp && File.exist?(sp)
      @unix_server = UNIXServer.new(sp)
      system "chmod 666 #{sp}"
    else
      abort "unknown ipc config: #{@config[:ipc]}"
    end

    trap(:INT) do
      warn 'SIGINT'
      @unix_server&.close
      exit
    end

    directory_manager = DirectoryManager.new(@config[:work_dir])

    loop do
      case @config[:ipc]
      when :stdio
        socket = ALSocket.new($stdin, $stdout)
      when :unix
        unix_socket = @unix_server.accept
        socket = ALSocket.new(unix_socket, unix_socket)
      else
        # break  # steep cant use break?
        exit 1
      end

      # obvious
      # @type var socke: untyped
      socke = socket
      receiver = ALReceiver.new(socke)

      receiver.handle do |json_line, reporter, local_storage|
        # NOTE: ノンブロッキングで書く必要がある。TaskStoreがかなり怪しいが
        # ノンブロッキングで書くか、thread + chdir禁止か。forkはメモリを簡単に共有出来ないのでNG
        task = ALTaskFactory.from_json json_line
        if task
          task.action(reporter, local_storage, directory_manager)
        else
          wlog "unknown method: #{json_line['method']}"
          reporter.report({ success: false, error: 'unknown method' })
        end
      end

      case @config[:ipc]
      when :unix
        unix_socket.close
      end

      # break unless @config[:loop] # steep cant use break?
      exit 0 unless @config[:loop]
    end
  end
end
