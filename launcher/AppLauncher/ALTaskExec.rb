# frozen_string_literal: true

require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskExec
  include ALTask

  def action(param, reporter, local_storage)
    command = param['cmd']
    arguments = param['args']
    stdin = param['stdin'] || ''

    if command.nil? || command.empty?
      report_failed reporter, 'invalid arguments'
      return nil
    end

    in_r, in_w = IO.pipe
    out_r, out_w = IO.pipe
    err_r, err_w = IO.pipe
    in_w.print stdin
    in_w.close
    exe = Executor.new(cmd: command, args: arguments, stdin: in_r, stdout: out_w, stderr: err_w)
    pid, = exe.execute(true) do
      # finish
      vlog "do_exec: finish pid=#{pid}"
      output = out_r.read
      errlog = err_r.read
      out_r.close
      err_r.close
      reporter.report({ success: true, result: { exited: true, out: output, err: errlog } })
      local_storage.delete :pid
    end
    vlog "do_exec: start pid=#{pid}"
    reporter.report({ success: true, continue: true, taskid: 1, result: { exited: false } })
    local_storage[:pid] = pid
  end
end
