# frozen_string_literal: true

require_root 'launcher/lib/Executor.rb'

RSpec.describe Executor do
  it 'blocking execution' do
    r, w = IO.pipe
    e = Executor.new(cmd: 'echo hello', stdout: w)
    e.execute
    msg = r.read
    r.close
    expect(msg.chomp).to eq 'hello'
  end
  it 'blocking execution (io)' do
    ir, iw = IO.pipe
    r, ow = IO.pipe
    iw.print "foo\nbar\nbaz\n"
    iw.close
    e = Executor.new(cmd: 'tac', stdin: ir, stdout: ow, timeout: 1)
    e.execute
    msg = r.read
    r.close
    expect(msg.chomp.split).to eq %w[baz bar foo]
  end
  it 'blocking execution args' do
    ir, iw = IO.pipe
    r, ow = IO.pipe
    iw.print 'foo'
    iw.close
    e = Executor.new(cmd: 'cat', args: ['-n'], stdin: ir, stdout: ow, timeout: 1)
    e.execute
    msg = r.read
    r.close
    expect(msg.chomp).to match(/^\s*1\s*foo\s*$/)
  end
  it 'blocking execution (timeout)' do
    t = Time.now
    e = Executor.new(cmd: 'sleep 5', timeout: 0.2)
    diff = Time.now - t
    pid, stat = e.execute
    expect(stat).to eq nil
    expect(diff).to be < 1
  end
  it 'nonblocking execution' do
    r, w = IO.pipe
    stat = nil
    e = Executor.new(cmd: 'echo hello', stdout: w)
    e.execute(true) do |s|
      stat = s
    end
    msg = r.read
    r.close
    expect(msg.chomp).to eq 'hello'
    sleep 0.2
    expect(stat.nil?).to eq false
    expect(stat.success?).to eq true
    expect(stat.signaled?).to eq false
  end
  it 'nonblocking execution (kill)' do
    stat = nil
    e = Executor.new(cmd: 'sleep 3')
    pid, = e.execute(true) do |s|
      stat = s
    end
    sleep 0.1
    Process.kill 2, pid # SIGINT
    sleep 0.1
    expect(stat.nil?).to eq false
    expect(stat.signaled?).to eq true
  end
end
