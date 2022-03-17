# frozen_string_literal: true

require 'json'
require_relative './stub_launcher'

RSpec.describe Executor do
  it 'cpp routine' do
    launcher = StubLauncher.new
    r2s_queue = Queue.new
    # NOTE: 子ThreadでRSpecのexpectは基本的に使えない
    # Thread#joinで例外を投げるthreadを待つことで、expectを有効化する
    # https://qiita.com/ledsun/items/0e1dd4ece43dc56653c7#%E5%AD%90%E3%82%B9%E3%83%AC%E3%83%83%E3%83%89%E3%81%A7expect
    phase_count = -2
    work_box_id = nil
    # sender
    t1 = Thread.start do
      w = launcher.writer

      # phase -2: box configuration
      din = JSON.generate(
        { 'method' => 'setupbox',
          'id' => { 'request_id' => 0 } }
      )
      phase_count += 1
      w.puts din
      w.flush

      # phase 0: upload files
      msg = r2s_queue.pop # block thread
      Thread.current.exit unless msg
      expect(phase_count).to eq 0
      din = JSON.generate(
        { 'method' => 'store',
          'box' => work_box_id,
          'files' => [
            { 'path' => 'code.cpp',
              'data' => <<~'CODE_CPP_EOS'
                #include <bits/stdc++.h>
                using namespace std;
                int main() {  // ”ぬ”
                  vector<int> vec;
                  int n; cin >> n;
                  for (int i = 0; i < n; ++i) {
                    int x; cin >> x;
                    vec.push_back(x);
                  }
                  sort(vec.begin(), vec.end());
                  for (int i = 0; i < n; ++i) {
                    cout << vec[i] << ' ';
                  }
                  cout << endl;
                  return 0;
                }
              CODE_CPP_EOS
},
            { 'path' => 'stdin.txt',
              'data' => "5\n3 7 4 5 2\n" }
          ],
          'id' => {
            'request_id' => 1 # (server)ユーザのアクション単位で共通　KILLは別のアクションなのでrequest_idは異なる
          } }
      )
      phase_count += 1
      w.puts din
      w.flush

      # phase 2: compile
      msg = r2s_queue.pop # block thread
      Thread.current.exit unless msg
      expect(phase_count).to eq 2
      din = JSON.generate(
        { 'method' => 'exec',
          'box' => work_box_id,
          'cmd' => 'g++',
          'args' => ['-std=c++17', '-O3', '-Wall', '-o', 'prog', 'code.cpp'],
          'id' => { 'request_id' => 2 } }
      )
      phase_count += 1
      w.puts din
      w.flush

      # phase 5: run
      msg = r2s_queue.pop # block thread
      Thread.current.exit unless msg
      expect(phase_count).to eq 5
      din = JSON.generate(
        { 'method' => 'exec',
          'box' => work_box_id,
          'cmd' => './prog',
          'args' => [],
          'stdin' => "5\n3 7 4 5 2\n",
          'id' => { 'request_id' => 3 } }
      )
      phase_count += 1
      w.puts din
      w.flush

      # phase 8: run2
      msg = r2s_queue.pop # block thread
      Thread.current.exit unless msg
      expect(phase_count).to eq 8
      din = JSON.generate(
        { 'method' => 'execfileio',
          'box' => work_box_id,
          'cmd' => './prog',
          'args' => [],
          'stdin_path' => 'stdin.txt',
          'stdout_path' => 'stdout.txt',
          'stderr_path' => 'stderr.txt',
          'id' => { 'request_id' => 4 } }
      )
      phase_count += 1
      w.puts din
      w.flush

      # phase 11: download file
      # TODO: check invalid filepath
      msg = r2s_queue.pop # block thread
      Thread.current.exit unless msg
      expect(phase_count).to eq 11
      din = JSON.generate(
        { 'method' => 'pull',
          'box' => work_box_id,
          'files' => [
            { 'path' => 'code.cpp' },
            { 'path' => 'stdout.txt' }
          ],
          'id' => { 'request_id' => 5 } }
      )
      phase_count += 1
      w.puts din
      w.flush

      # phase 13: box finalization
      msg = r2s_queue.pop # block thread
      Thread.current.exit unless msg
      expect(phase_count).to eq 13
      din = JSON.generate(
        { 'method' => 'cleanupbox',
          'box' => work_box_id,
          'id' => { 'request_id' => 6 } }
      )
      phase_count += 1
      w.puts din
      w.flush
    end

    # receiver
    t2 = Thread.start do
      r = launcher.reader

      # phase -1: notification(box complete) of phase -2
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq(-1)
      expect(json['success']).to eq true
      work_box_id = json['result']['box']
      expect(json['id']).to eq({ 'request_id' => 0 })
      phase_count += 1
      r2s_queue.push phase_count

      # phase 1: notification(complete) of phase_count 0
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 1
      expect(json['success']).to eq true
      expect(json['id']).to eq({ 'request_id' => 1 })
      phase_count += 1
      r2s_queue.push phase_count

      # phase 3: notification(start) of phase 2
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 3
      expect(json['success']).to eq true
      expect(json['continue']).to eq true
      _taskid = json['taskid']
      expect(json['result']['exited']).to eq false
      expect(json['id']).to eq({ 'request_id' => 2 })
      phase_count += 1

      # phase 4: notification(exited) of phase 2
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 4
      expect(json['success']).to eq true
      expect(json['continue']).not_to eq true # false or null or undefined
      # expect(json['taskid']).to eq taskid
      expect(json['result']['exited']).to eq true
      expect(json['result']['exitstatus']).to eq 0
      expect(json['id']).to eq({ 'request_id' => 2 })
      phase_count += 1
      r2s_queue.push phase_count

      # phase 6: notification(start) of phase 5
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 6
      expect(json['success']).to eq true
      expect(json['continue']).to eq true
      _taskid = json['taskid'] # 上と同じtaskidで良いのか？
      expect(json['result']['exited']).to eq false
      expect(json['id']).to eq({ 'request_id' => 3 })
      phase_count += 1

      # phase 7: notification(start) of phase 5
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 7
      expect(json['success']).to eq true
      expect(json['continue']).not_to eq true # false or null or undefined
      # expect(json['taskid']).to eq taskid
      expect(json['result']['exited']).to eq true
      expect(json['result']['exitstatus']).to eq 0
      expect(json['result']['out']).to eq "2 3 4 5 7 \n"
      expect(json['id']).to eq({ 'request_id' => 3 })
      phase_count += 1
      r2s_queue.push phase_count

      # phase 9: notification(start) of phase 8
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 9
      expect(json['success']).to eq true
      expect(json['continue']).to eq true
      _taskid = json['taskid'] # 上と同じtaskidで良いのか？
      expect(json['result']['exited']).to eq false
      expect(json['id']).to eq({ 'request_id' => 4 })
      phase_count += 1

      # phase 10: notification(start) of phase 8
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 10
      expect(json['success']).to eq true
      expect(json['continue']).not_to eq true # false or null or undefined
      # expect(json['taskid']).to eq taskid
      expect(json['result']['exited']).to eq true
      expect(json['result']['exitstatus']).to eq 0
      expect(json['id']).to eq({ 'request_id' => 4 })
      phase_count += 1
      r2s_queue.push phase_count

      # phase 12: notification(pull) of phase 11
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 12
      expect(json['success']).to eq true
      expect(json['files']).to be_kind_of Array
      expect(json['files'].size).to eq 2
      expect(json['files'][0]).to be_kind_of Hash
      expect(json['files'][1]).to be_kind_of Hash
      expect(json['files'][0].keys.sort).to eq %w[data path]
      expect(json['files'][1].keys.sort).to eq %w[data path]
      idx_code = json['files'][0]['path'] == 'code.cpp' ? 0 : 1
      idx_out = json['files'][0]['path'] == 'stdout.txt' ? 0 : 1
      expect(json['files'][idx_code]['path']).to eq 'code.cpp'
      expect(json['files'][idx_code]['data']).to be_kind_of String
      expect(json['files'][idx_code]['data'][0..4]).to eq '#incl'
      expect(json['files'][idx_out]['path']).to eq 'stdout.txt'
      expect(json['files'][idx_out]['data']).to be_kind_of String
      expect(json['files'][idx_out]['data']).to eq "2 3 4 5 7 \n"
      expect(json['id']).to eq({ 'request_id' => 5 })
      phase_count += 1
      r2s_queue.push phase_count

      # phase 14: notification(cleanup box complete) of phase 13
      line = r.gets
      json = JSON.parse(line)
      expect(phase_count).to eq 14
      expect(json['success']).to eq true

      phase_count += 1
    end

    # launcher main
    t3 = Thread.start do
      launcher.main
    rescue IOError
      # ignore "stream closed in another thread"
    end

    wdt = Thread.start do
      sleep 20
      r2s_queue.push false
      launcher.close
    end

    t1.join
    t2.join
    launcher.close
    t3.join
    wdt.kill
  end
end
