# frozen_string_literal: true

require_relative 'lib/Executor.rb'
require_relative 'AppLauncherBase.rb'

class AppLauncherTask
  include AppLauncherBase

  def do_exec(param)
    command = param['cmd']
    arguments = param['args']
    stdin = param['stdin'] || ''

    return { success: false, error: 'invalid arguments' } if command.nil? || command.empty?

    in_r, in_w = IO.pipe
    out_r, out_w = IO.pipe
    err_r, err_w = IO.pipe
    in_w.print stdin
    in_w.close
    exe = Executor.new(cmd: command, args: arguments, stdin: in_r, stdout: out_w, stderr: err_w)
    exe.execute

    output = out_r.read
    errlog = err_r.read
    out_r.close
    err_r.close

    { success: true, result: { out: output, err: errlog } }
  end

  def do_store(param)
    files = param['files']
    return { success: false, error: 'invalid arguments' } if files.nil? || !files.is_a?(Array)

    # only check param
    files.each do |file|
      path = file['path']
      data = file['data']
      return { success: false, error: 'invalid arguments' } if path.nil? || data.empty?
      # note: chroot
      return { success: false, error: 'invalid arguments' } if path.start_with?('/') || path.include?('..')
    end
    # work
    files.each do |file|
      path = file['path']
      data = file['data']
      IO.write(path, data)
    end
    { success: true }
  end
end
