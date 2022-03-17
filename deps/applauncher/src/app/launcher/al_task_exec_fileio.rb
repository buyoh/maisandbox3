# frozen_string_literal: true

require 'tempfile'

require_relative '../../lib/executor'
require_relative 'al_task'

# ALTaskExec
# 標準入出力をファイルで指定する
# コンパイルエラー等出力されるファイルが大きくなる可能性がある場合につかう
# 標準出力も返却しないのでALTaskPullを使って取得する。
# TODO: resolve code length
class ALTaskExecFileIO
  include ALTask

  def initialize(box, command, arguments, stdin_path, stdout_path, stderr_path, timeout) # rubocop:disable Metrics/ParameterLists
    @box = box
    @command = command
    @arguments = arguments
    @stdin_path = stdin_path # String || nil
    @stdout_path = stdout_path  # String || nil
    @stderr_path = stderr_path  # String || nil
    @timeout = timeout
  end

  def self.check_valid_filequery(path)
    !path.nil? && !path.start_with?('/') && !path.include?('..')
  end

  def self.from_json(param)
    box = param['box']
    cmd = param['cmd']
    # @type var args: untyped
    args = param['args'] || []
    # @type var stdin_path: untyped
    # @type var stdout_path: untyped
    # @type var stderr_path: untyped
    stdin_path = param['stdin_path']
    stdout_path = param['stdout_path']
    stderr_path = param['stderr_path']
    timeout = param['timeout'] || 10
    return nil unless box.is_a?(String) && !box.empty?
    return nil unless cmd.is_a?(String) && !cmd.empty?
    return nil unless args.is_a?(Array) && args.all? { |e| e.is_a?(String) }
    return nil unless (stdin_path.is_a?(String) && check_valid_filequery(stdin_path)) || stdin_path.nil?
    return nil unless (stdout_path.is_a?(String) && check_valid_filequery(stdout_path)) || stdout_path.nil?
    return nil unless (stderr_path.is_a?(String) && check_valid_filequery(stderr_path)) || stderr_path.nil?
    return nil unless timeout.is_a? Integer # TODO: assert range

    new(box, cmd, args, stdin_path, stdout_path, stderr_path, timeout)
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

    if !@stdin_path.nil? && !File.exist?("#{exec_chdir}/#{@stdin_path}")
      report_failed reporter, 'invalid arguments'
      return nil
    end

    in_file = @stdin_path.nil? ? File.open(File::NULL, 'r') : File.open("#{exec_chdir}/#{@stdin_path}", 'r')
    out_file = @stdout_path.nil? ? File.open(File::NULL, 'w') : File.open("#{exec_chdir}/#{@stdout_path}", 'w')
    err_file = @stderr_path.nil? ? File.open(File::NULL, 'w') : File.open("#{exec_chdir}/#{@stderr_path}", 'w')
    exe = Executor.new(
      cmd: @command,
      args: @arguments,
      stdin: in_file, stdout: out_file, stderr: err_file,
      chdir: exec_chdir,
      timeout: @timeout
    )

    # for generate task_id
    seed = Time.now.to_i

    pid, = exe.execute(true) do |status, time|
      # finish
      # vlog "do_exec: finish pid=#{pid}"
      in_file.close
      out_file.close
      err_file.close

      reporter.report(
        { success: true,
          result: { exited: true, exitstatus: status&.exitstatus, time: time } }
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
