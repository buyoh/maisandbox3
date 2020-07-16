# 適切な権限に変更して実行する人
# docker上を仮定(後で)
# ファイル転送はなし。dockerのボリュームマッピングを使う。
# 実行だけdocker上から行う。
# interactiveは後で追加。

require 'json'
require_relative 'lib/executor.rb'

@verbose = true
@superuser = false

def vlog(str)
  STDERR.puts str if @verbose
end

def responce(data)
  STDOUT.puts JSON.generate(data)
  STDOUT.flush
end

def do_exec(param)
  command = param['cmd']
  arguments = param['args']
  stdin = param['stdin'] || ''

  return {success: false, error: 'invalid arguments'} if command.nil? || command.empty?

  in_r, in_w = IO.pipe
  out_r, out_w = IO.pipe
  err_r, err_w = IO.pipe
  in_w.print stdin
  in_w.close
  vlog stdin
  exe = Executor.new(cmd: command, args: arguments, stdin: in_r, stdout: out_w, stderr: err_w)
  exe.execute()

  output = out_r.read
  errlog = err_r.read
  out_r.close
  err_r.close

  return {success: true, result: {out: output, err: errlog}}
end

def do_store(param)
  files = param['files']
  return {success: false, error: 'invalid arguments'} if files.nil? || !files.is_a?(Array)
  # only check param
  files.each do |file|
    path = file['path']
    data = file['data']
    return {success: false, error: 'invalid arguments'} if path.nil? || data.empty?
    # note: chroot
    return {success: false, error: 'invalid arguments'} if path.start_with?('/') || path.include?('..')
  end
  # work
  files.each do |file|
    path = file['path']
    data = file['data']
    IO.write(path, data)
  end
  return {success: true}
end

trap(:INT) do
  vlog 'SIGINT'
  exit
end

while raw_line = STDIN.gets
  # note: dont forget "\n"
  # note: block each line
  vlog "recv: #{raw_line}"
  json_line = nil
  begin
    json_line = JSON.parse(raw_line)
  rescue JSON::JSONError => e
    vlog e
    responce ({success: false, error: 'json parse error'})
  end
  next if json_line.nil?

  id = json_line['id']

  case json_line['method']
  when 'store'
    responce do_store(json_line).merge({id: id})
  when 'exec'
    responce do_exec(json_line).merge({id: id})
  else
    responce ({success: false, error: 'unknown method', id: id})
    vlog "unknown method: #{json_line['method']}"
    next
  end
end
