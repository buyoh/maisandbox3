# frozen_string_literal: true

require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskExec
  include ALTask

  def initialize(directory_manager)
    @directory_manager = directory_manager
  end

  def action(param, reporter, local_storage)
    box = param['box']
    if box.nil? || !@directory_manager.box_exists?(local_storage[:socket_id_str], box)
      report_failed reporter, 'uninitialized box'
      return nil
    end

    command = param['cmd']
    arguments = param['args']
    stdin = param['stdin'] || ''

    if command.nil? || command.empty?
      report_failed reporter, 'invalid arguments'
      return nil
    end

    exec_chdir = @directory_manager.get_boxdir(local_storage[:socket_id_str], box)

    in_r, in_w = IO.pipe
    out_r, out_w = IO.pipe
    err_r, err_w = IO.pipe
    in_w.print stdin
    in_w.close
    exe = Executor.new(
      cmd: command,
      args: arguments,
      stdin: in_r, stdout: out_w, stderr: err_w,
      chdir: exec_chdir
    )
    pid, = exe.execute(true) do |status|
      # finish
      # vlog "do_exec: finish pid=#{pid}"
      output = out_r.read
      errlog = err_r.read
      out_r.close
      err_r.close
      reporter.report(
        { success: true,
          result: { exited: true, exitstatus: status&.exitstatus, out: output, err: errlog } }
      )
      local_storage.delete :pid
    end
    # vlog "do_exec: start pid=#{pid}"
    reporter.report(
      { success: true, continue: true, taskid: 1,
        result: { exited: false } }
    )
    local_storage[:pid] = pid
  end
end
