# frozen_string_literal: true

# require 'stringio'

# -----------------------------------------------------------------------------
# launch application
#
class Executor
  # cmd:
  # args:
  # stdin: String(filepath) or IO(pipe)
  # stdout: String(filepath) or IO(pipe)
  # stderr: String(filepath) or IO(pipe)
  # timeout: Number
  # chdir: String
  def initialize(args)
    @cmd = args[:cmd]
    @args = args[:args] || []
    @stdin = args[:stdin] || File::NULL
    @stdout = args[:stdout] || File::NULL
    @stderr = args[:stderr] || File::NULL
    @timeout = args[:timeout] || 10
    @chdir = args[:chdir]
    raise ArgumentError unless @cmd

    @status = nil
  end

  attr_writer :stdin
  attr_writer :stdout
  attr_writer :stderr

  def reset
    @status = nil
  end

  def execute(noblock = false, &onfinished)
    @status = nil

    # execute command
    pid = fork do
      # 実行ユーザ変更の機能追加を考慮してspawnでは無い
      h = {
        in: @stdin,
        out: @stdout,
        err: @stderr
      }
      h[:chdir] = @chdir if @chdir
      exec(@cmd, *@args, h)
    rescue StandardError
      exit 127
    end

    t1 = nil
    t2 = nil
    # timeout thread
    t1 = Thread.start do
      sleep @timeout
      Process.kill :KILL, pid
      t2.exit # Ruby does not have race like javascript Promise.race
    end
    # waitpid thread
    t2 = Thread.start do
      pid, s = Process.waitpid2(pid)
      @status = s
      t1.exit
    end

    race_and_finalize = lambda do
      # wait
      [t1, t2].each(&:join)

      # finalize
      @stdin.close if @stdin.respond_to?(:close)
      @stdout.close if @stdout.respond_to?(:close)
      @stderr.close if @stderr.respond_to?(:close)

      # callback if onfinished is not nil
      onfinished&.call(@status)
    end

    if noblock
      # wait by another thread
      Thread.start(&race_and_finalize)
      # pid を返すので、殺したくなったら Process::kill してね
      [pid, nil]
    else
      race_and_finalize.call
      [pid, @status]
    end
  end

  def self.kill(pid)
    Process.kill(:KILL, pid)
  end

  attr_reader :status
end
