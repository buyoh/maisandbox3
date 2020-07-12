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
  def initialize(args)
    @cmd = args[:cmd]
    @args = args[:args] || []
    @stdin = args[:stdin] || File::NULL
    @stdout = args[:stdout] || File::NULL
    @stderr = args[:stderr] || File::NULL
    @timeout = args[:timeout] || 5
    raise ArgumentError unless @cmd
    @status = nil
  end
  def stdin=(v)
    @stdin = v
  end
  def stdout=(v)
    @stdout = v
  end
  def stderr=(v)
    @stderr = v
  end

  # 

  def reset()
    @status = nil
  end

  def execute(noblock = false, &onfinished)
    @status = nil

    # execute command
    pid = fork do
      # 実行ユーザ変更の機能追加を考慮してspawnでは無い
      exec(@cmd, *@args,
        in: @stdin,
        out: @stdout,
        err: @stderr)
    end

    t1, t2 = nil, nil
    # timeout thread
    t1 = Thread.start do
      sleep @timeout
      t2.exit  # Ruby does not have race like javascript Promise.race
    end
    # waitpid thread
    t2 = Thread.start do
      pid, s = Process.waitpid2(pid)
      @status = s
      t1.exit
    end

    race_and_finalize = lambda do
      # wait
      [t1, t2].each{|t| t.join }

      # finalize
      @stdin.close if @stdin.respond_to?(:close)
      @stdout.close if @stdout.respond_to?(:close)
      @stderr.close if @stderr.respond_to?(:close)
      
      # callback if onfinished is not nil
      onfinished.call(@status) if onfinished
    end

    if noblock
      # wait by another thread
      Thread.start &race_and_finalize
      # pid を返すので、殺したくなったら Process::kill してね
      return [pid, nil]
    else
      race_and_finalize.call
      return [pid, @status]
    end

  end

  #

  def status
    @status
  end

end
