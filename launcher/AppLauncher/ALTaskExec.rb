# frozen_string_literal: true

require 'tempfile'

require_relative '../lib/Executor'
require_relative 'ALTask'

class ALTaskExec
  include ALTask

  def initialize(directory_manager)
    @directory_manager = directory_manager
  end

  def validate_param(param, local_storage)
    param = param.clone
    param.delete 'method'
    box = param['box']
    if box.nil? || !@directory_manager.box_exists?(local_storage[:socket_id_str], box)
      abort 'ALTaskExec: validation failed: box'
    end
    param.delete 'box'
    abort 'ALTaskExec: validation failed: cmd' if !param['cmd'] || param['cmd'].empty?
    param.delete 'cmd'
    param.delete 'args'
    param.delete 'stdin'
    param.delete 'fileio'
    abort 'ALTaskExec: validation failed: cmd' unless param.empty?
  end

  def action(param, reporter, local_storage)
    validate_param param, local_storage if validation_enabled?
    box = param['box']
    if box.nil? || !@directory_manager.box_exists?(local_storage[:socket_id_str], box)
      report_failed reporter, 'uninitialized box'
      return nil
    end

    command = param['cmd']
    arguments = param['args']
    stdin = param['stdin'] || ''
    fileio = param['fileio'] == true

    if command.nil? || command.empty?
      report_failed reporter, 'invalid arguments'
      return nil
    end

    exec_chdir = @directory_manager.get_boxdir(local_storage[:socket_id_str], box)

    if fileio
      in_file = Tempfile.open('in', exec_chdir, mode: File::Constants::RDWR)
      out_file = Tempfile.open('in', exec_chdir, mode: File::Constants::RDWR)
      err_file = Tempfile.open('in', exec_chdir, mode: File::Constants::RDWR)
      in_file.print stdin
      in_file.close
      in_file.open
      exe = Executor.new(
        cmd: command,
        args: arguments,
        stdin: in_file, stdout: out_file, stderr: err_file,
        chdir: exec_chdir
      )
    else
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
    end

    pid, = exe.execute(true) do |status, time|
      # finish
      # vlog "do_exec: finish pid=#{pid}"
      if fileio
        in_file.close
        out_file.close
        err_file.close
        out_file.open
        output = out_file.read
        out_file.close
        err_file.open
        errlog = err_file.read
        err_file.close
        in_file.delete
        out_file.delete
        err_file.delete
      else
        output = out_r.read
        errlog = err_r.read
        out_r.close
        err_r.close
      end
      reporter.report(
        { success: true,
          result: { exited: true, exitstatus: status&.exitstatus, time: time,
                    out: output, err: errlog } }
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
