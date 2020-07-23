# frozen_string_literal: true

require_relative 'lib/Executor.rb'
require_relative 'AppLauncherBase.rb'

class AppLauncherTask
  include AppLauncherBase

  def report_failed(reporter, err)
    reporter.report({ success: false, error: err })
  end

  def do_exec(param, reporter)
    command = param['cmd']
    arguments = param['args']
    stdin = param['stdin'] || ''

    if command.nil? || command.empty?
      report_failed reporter, 'invalid arguments'
      return
    end

    in_r, in_w = IO.pipe
    out_r, out_w = IO.pipe
    err_r, err_w = IO.pipe
    in_w.print stdin
    in_w.close
    exe = Executor.new(cmd: command, args: arguments, stdin: in_r, stdout: out_w, stderr: err_w)
    pid, = exe.execute(true) do
      # finish
      output = out_r.read
      errlog = err_r.read
      out_r.close
      err_r.close
      reporter.report({ success: true, result: { exited: true, out: output, err: errlog } })
    end
    reporter.report({ success: true, continue: true, taskid: 1, result: { exited: false } })
  end

  def do_store(param, reporter)
    files = param['files']
    if files.nil? || !files.is_a?(Array)
      report_failed reporter, 'invalid arguments'
      return
    end

    # check param
    if files.any? do |file|
         path = file['path']
         data = file['data']
         path.nil? || data.empty? || path.start_with?('/') || path.include?('..')
       end
      report_failed reporter, 'invalid arguments'
      return
    end

    # work
    files.each do |file|
      path = file['path']
      data = file['data']
      IO.write(path, data)
    end
    reporter.report({ success: true })
  end
end
