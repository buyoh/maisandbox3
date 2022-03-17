# frozen_string_literal: true

require 'tempfile'

require_relative '../../lib/executor'
require_relative 'al_task'

# ALTaskExec
# ruby -v など軽量なプログラムを実行する時に使う。
# 出力されるファイルが100KB級で大きくなる可能性が有る場合は ALTaskExecFileIO を使う
# TODO: resolve code length
class ALTaskExec
  include ALTask

  def initialize(box, command, arguments, stdin, timeout)
    @box = box
    @command = command
    @arguments = arguments
    @stdin = stdin
    @timeout = timeout
  end

  def self.from_json(param)
    box = param['box']
    cmd = param['cmd']
    # @type var args: untyped
    args = param['args'] || []
    stdin = param['stdin'] || ''
    timeout = param['timeout'] || 10
    return nil unless box.is_a?(String) && !box.empty?
    return nil unless cmd.is_a?(String) && !cmd.empty?
    return nil unless args.is_a?(Array) && args.all? { |e| e.is_a?(String) }
    return nil unless stdin.is_a? String
    return nil unless timeout.is_a? Integer # TODO: assert range

    new(box, cmd, args, stdin, timeout)
  end

  def action(reporter, local_storage, directory_manager)
    user_id = local_storage[:user_id_str]
    if @box.nil? || !directory_manager.box_exists?(user_id, @box)
      report_failed reporter, 'uninitialized box'
      return nil
    end

    if @command.nil? || @command.empty?
      report_failed reporter, 'invalid arguments'
      return nil
    end

    exec_chdir = directory_manager.get_boxdir(user_id, @box)

    if exec_chdir.nil?
      report_failed reporter, 'invalid arguments'
      return nil
    end

    in_r, in_w = IO.pipe
    out_r, out_w = IO.pipe
    err_r, err_w = IO.pipe
    in_w.print @stdin
    in_w.close
    exe = Executor.new(
      cmd: @command,
      args: @arguments,
      stdin: in_r, stdout: out_w, stderr: err_w,
      chdir: exec_chdir,
      timeout: @timeout
    )

    # for generate task_id
    seed = Time.now.to_i

    pid, = exe.execute(true) do |status, time|
      # finish
      # vlog "do_exec: finish pid=#{pid}"
      # @type var out_r: untyped
      # @type var err_r: untyped
      output = out_r.read
      errlog = err_r.read
      out_r.close
      err_r.close
      reporter.report(
        { success: true,
          result: { exited: true, exitstatus: status&.exitstatus, time: time,
                    out: output, err: errlog } }
      )

      exec_task_id = "#{user_id}@#{pid}@#{seed}".hash.to_s(36)
      exec_tasks = local_storage[:exec_tasks]
      exec_tasks.delete exec_task_id if exec_tasks && exec_tasks[exec_task_id]
    end

    exec_task_id = "#{user_id}@#{pid}@#{seed}".hash.to_s(36)

    # vlog "do_exec: start pid=#{pid}"
    reporter.report(
      { success: true, continue: true, taskid: exec_task_id,
        result: { exited: false } }
    )

    # always Hash[Symbol, String]
    # @type var exec_tasks: untyped
    exec_tasks = local_storage[:exec_tasks] || {}
    wlog 'duplicate exec_task_id!' unless exec_tasks[exec_task_id].nil?
    exec_tasks[exec_task_id] = pid
    local_storage[:exec_tasks] = exec_tasks
    nil
  end
end
