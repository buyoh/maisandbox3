# frozen_string_literal: true

require 'tmpdir'
require_root 'lib/directory_manager/directory_manager.rb'

RSpec.describe DirectoryManager do
  it 'create dirs' do
    Dir.mktmpdir do |tmpdir|
      dm = DirectoryManager.new tmpdir
      user1 = 'aaaaa'
      user2 = 'aaaab'
      dm.install_user user1
      user1_box1 = dm.new_box(user1)
      user1_box1_dir = dm.get_boxdir(user1, user1_box1)
      expect(Dir.exist?(user1_box1_dir)).to eq true
      user1_box2 = dm.new_box(user1)
      user1_box2_dir = dm.get_boxdir(user1, user1_box2)
      expect(Dir.exist?(user1_box2_dir)).to eq true

      expect(dm.user_exists?(user1)).to eq true
      expect(dm.box_exists?(user1, user1_box1)).to eq true
      expect(dm.user_exists?(user2)).to eq false
      expect(dm.box_exists?(user1, "#{user1_box1}xxx")).to eq false

      dm.install_user user2
      user2_box1 = dm.new_box(user2)
      user2_box1_dir = dm.get_boxdir(user2, user2_box1)
      expect(Dir.exist?(user2_box1_dir)).to eq true
      user2_box2 = dm.new_box(user2)
      user2_box2_dir = dm.get_boxdir(user2, user2_box2)
      expect(Dir.exist?(user2_box2_dir)).to eq true

      expect(user1_box1_dir).not_to eq user1_box2_dir
      expect(user1_box1_dir).not_to eq user2_box1_dir

      dm.delete_box(user1, user1_box2)
      expect(Dir.exist?(user1_box1_dir)).to eq true
      expect(Dir.exist?(user1_box2_dir)).to eq false

      dm.uninstall_user user1
      expect(Dir.exist?(user1_box1_dir)).to eq false
      expect(Dir.exist?(user2_box1_dir)).to eq true
      dm.uninstall_user user2
    end
  end
end
