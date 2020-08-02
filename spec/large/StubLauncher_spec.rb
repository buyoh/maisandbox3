# frozen_string_literal: true

require 'json'
require_relative './StubLauncher.rb'

RSpec.describe Executor do
  it 'cpp routine' do
    launcher = StubLauncher.new
    r2s_queue = Queue.new
    # note: 子ThreadでRSpecのexpectは基本的に使えない
    # Thread#joinで例外を投げるthreadを待つことで、expectを有効化する
    # https://qiita.com/ledsun/items/0e1dd4ece43dc56653c7#%E5%AD%90%E3%82%B9%E3%83%AC%E3%83%83%E3%83%89%E3%81%A7expect
    phase = 0
    # sender
    t1 = Thread.start do
      w = launcher.writer
      # phase 0: upload files
      din = JSON.generate(
        { 'method' => 'store',
          'files' => [
            { 'path' => 'code.cpp',
              'data' => <<~'CODE_CPP_EOS'
                #include <bits/stdc++.h>
                using namespace std;
                
                int main() {
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
}
          ],
          'id' => {
            'jid' => { 'clicmid' => 1 }, # (client)ビルド→実行のワークフローで共通　KILLも共通
            'sid' => 'socketio', # (server)ページ単位で共通
            'lcmid' => 1 # (server)ユーザのアクション単位で共通　KILLは別のアクションなのでlcmidは異なる
          } }
      )
      phase += 1
      w.puts din
      w.flush

      # phase 2: compile
      msg = r2s_queue.pop # block thread
      Thread.current.exit unless msg
      expect(phase).to eq 2
      din = JSON.generate(
        { 'method' => 'exec',
          'cmd' => 'g++',
          'args' => ['-std=c++17', '-O3', '-Wall', '-o', 'prog', 'code.cpp'],
          'id' => { 'jid' => { 'clicmid' => 1 }, 'sid' => 'socketio', 'lcmid' => 2 } }
      )
      phase += 1
      w.puts din
      w.flush

      # phase 5: run
      msg = r2s_queue.pop # block thread
      Thread.current.exit unless msg
      expect(phase).to eq 5
      din = JSON.generate(
        { 'method' => 'exec',
          'cmd' => './prog',
          'args' => [],
          'stdin' => "5\n3 7 4 5 2\n",
          'id' => { 'jid' => { 'clicmid' => 1 }, 'sid' => 'socketio', 'lcmid' => 3 } }
      )
      phase += 1
      w.puts din
      w.flush
    end

    # reciever
    t2 = Thread.start do
      r = launcher.reader

      # phase 1: notification(complete) of phase 0
      line = r.gets
      json = JSON.parse(line)
      expect(phase).to eq 1
      expect(json['success']).to eq true
      expect(json['id']).to eq({ 'jid' => { 'clicmid' => 1 }, 'sid' => 'socketio', 'lcmid' => 1 })
      phase += 1
      r2s_queue.push phase

      # phase 3: notification(start) of phase 2
      line = r.gets
      json = JSON.parse(line)
      expect(phase).to eq 3
      expect(json['success']).to eq true
      expect(json['continue']).to eq true
      _taskid = json['taskid']
      expect(json['result']['exited']).to eq false
      expect(json['id']).to eq({ 'jid' => { 'clicmid' => 1 }, 'sid' => 'socketio', 'lcmid' => 2 })
      phase += 1

      # phase 4: notification(exited) of phase 2
      line = r.gets
      json = JSON.parse(line)
      expect(phase).to eq 4
      expect(json['success']).to eq true
      expect(json['continue']).not_to eq true # false or null or undefined
      # expect(json['taskid']).to eq taskid
      expect(json['result']['exited']).to eq true
      expect(json['result']['exitstatus']).to eq 0
      expect(json['id']).to eq({ 'jid' => { 'clicmid' => 1 }, 'sid' => 'socketio', 'lcmid' => 2 })
      phase += 1
      r2s_queue.push phase

      # phase 6: notification(start) of phase 5
      line = r.gets
      json = JSON.parse(line)
      expect(phase).to eq 6
      expect(json['success']).to eq true
      expect(json['continue']).to eq true
      _taskid = json['taskid'] # 上と同じtaskidで良いのか？
      expect(json['result']['exited']).to eq false
      expect(json['id']).to eq({ 'jid' => { 'clicmid' => 1 }, 'sid' => 'socketio', 'lcmid' => 3 })
      phase += 1

      # phase 7: notification(start) of phase 5
      line = r.gets
      json = JSON.parse(line)
      expect(phase).to eq 7
      expect(json['success']).to eq true
      expect(json['continue']).not_to eq true # false or null or undefined
      # expect(json['taskid']).to eq taskid
      expect(json['result']['exited']).to eq true
      expect(json['result']['exitstatus']).to eq 0
      expect(json['result']['out']).to eq "2 3 4 5 7 \n"
      expect(json['id']).to eq({ 'jid' => { 'clicmid' => 1 }, 'sid' => 'socketio', 'lcmid' => 3 })
      phase += 1
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
