# frozen_string_literal: true

require_relative 'lib/Executor'
require_relative 'AppLauncherBase'

class AppLauncherTask
  include AppLauncherBase

  def report_failed(reporter, err)
    reporter.report({ success: false, error: err })
  end

  def do_exec(param, reporter, local_storage)
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

  def do_kill(_param, reporter, local_storage)
    if !local_storage.key?(:pid) || local_storage[:pid].nil?
      vlog 'do_kill: no action'
      reporter.report({ success: true, continue: true, result: { send: false } })
      return nil
    end
    pid = local_storage[:pid]
    Executor.kill pid
    vlog "do_kill: kill pid=#{pid}"
    reporter.report({ success: true, continue: true, result: { send: true } })
  end

  def do_store(param, reporter, _local_storage)
    files = param['files']
    if files.nil? || !files.is_a?(Array)
      report_failed reporter, 'invalid arguments'
      return nil
    end

    # check param
    if files.any? do |file|
         path = file['path']
         data = file['data']
         path.nil? || data.empty? || path.start_with?('/') || path.include?('..')
       end
      report_failed reporter, 'invalid arguments'
      return nil
    end

    # work
    files.each do |file|
      path = file['path']
      data = file['data']
      IO.write(path, data)
    end
    reporter.report({ success: true })
    nil
  end
end
