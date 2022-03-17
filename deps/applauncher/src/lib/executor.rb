# frozen_string_literal: true

# require 'stringio'

class Thread
  def self.start3(lam)
    # @type var s: untyped
    s = self
    s.start(&lam)
  end
end

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
  def initialize(cmd: '', args: [], stdin: File::NULL, stdout: File::NULL, stderr: File::NULL, timeout: 10, chdir: '.')
    @cmd = cmd
    @args = args
    @stdin = stdin
    @stdout = stdout
    @stderr = stderr
    @timeout = timeout
    @chdir = chdir
    @status = nil
  end

  attr_writer :stdin, :stdout, :stderr # TODO: unnecessary?

  def reset
    @status = nil
    nil
  end

  # NOTE: Style/OptionalBooleanParameter
  def execute(noblock = false, &onfinished)
    @status = nil

    # execute command
    pid = fork do
      # 実行ユーザ変更の機能追加を考慮してspawnでは無い
      # @type var h: untyped
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

    # never happen (impl for RBS)
    return [-1, nil, nil] if pid.nil?

    start_time = Time.now.to_f
    # @type var time: Float?
    time = nil

    # NOTE: Ruby does not have race like javascript Promise.race

    # @type var t1: Thread?
    t1 = nil
    # @type var t2: Thread?
    t2 = nil
    # timeout thread
    t1 = Thread.start do
      sleep @timeout
      Process.kill :KILL, pid
      t2.exit if t2.is_a? Thread
    end
    # waitpid thread
    t2 = Thread.start do
      pid, s = Process.waitpid2(pid)
      time = Time.now.to_f - start_time
      @status = s
      t1.exit if t1.is_a? Thread
    end

    race_and_finalize = lambda do
      # @type var t1: Thread
      # @type var t2: Thread
      # wait
      # [t1, t2].each(&:join) # cant wrote in RBS
      t1.join
      t2.join

      # finalize
      # RBS does not work...
      # @stdin.close if @stdin.respond_to?(:close)
      # @stdout.close if @stdout.respond_to?(:close)
      # @stderr.close if @stderr.respond_to?(:close)
      if @stdin.respond_to?(:close)
        # @type var o: untyped
        o = @stdin
        o.close
      end
      if @stdout.respond_to?(:close)
        # @type var o: untyped
        o = @stdout
        o.close
      end
      if @stderr.respond_to?(:close)
        # @type var o: untyped
        o = @stderr
        o.close
      end

      # callback if onfinished is not nil
      onfinished&.call(@status, time)
    end

    if noblock
      # wait by another thread
      # Thread.start2(&race_and_finalize)
      Thread.start3(race_and_finalize)
      # pid を返すので、殺したくなったら Process::kill してね
      [pid, nil, nil]
    else
      race_and_finalize.call
      [pid, @status, time]
    end
  end

  def self.kill(pid)
    Process.kill(:KILL, pid)
  end

  attr_reader :status
end
