# frozen_string_literal: true

require 'fileutils'
require_relative 'ALBase'

# root/[user]/[box] の2層を管理する
class ALDirectoryManager
  include ALBase

  class UserDir
    def initialize(dirname)
      @dirname = dirname
      @key2dir = {}
      @boxid_counter = 1
    end
    attr_accessor :dirname

    def new_dir
      key = (@dirname + @boxid_counter.to_s).hash.to_s(36)
      @boxid_counter += 1
      dir = '_j_' + key.hash.to_s(36) + '/'
      @key2dir[key] = dir
      key
    end

    def get_boxdir(key)
      dir = @key2dir[key]
      return nil unless dir

      dir
    end

    def exists?(key)
      !@key2dir[key].nil?
    end
  end

  def initialize
    @key2userdir = {}
  end

  private

  def generate_userdirname(key)
    '/run/_u_' + key.hash.to_s(36) + '/'
  end

  public

  def install_user(user_key)
    dir = generate_userdirname(user_key)
    FileUtils.mkdir_p work_directory + dir
    @key2userdir[user_key] = UserDir.new(dir)
  end

  def uninstall_user(user_key)
    dir = @key2userdir[user_key].dirname
    return unless dir

    FileUtils.rm_rf work_directory + dir
    @key2userdir.delete user_key
  end

  def new_box(user_key)
    u = @key2userdir[user_key]
    return nil unless u

    key = u.new_dir
    j = u.get_boxdir(key)
    FileUtils.mkdir_p work_directory + u.dirname + j
    key
  end

  def get_boxdir(user_key, box_key)
    u = @key2userdir[user_key]
    return nil unless u

    j = u.get_boxdir(box_key)
    return nil unless j

    work_directory + u.dirname + j
  end

  def user_exists?(user_key)
    !@key2userdir[user_key].nil?
  end

  def box_exists?(user_key, box_key)
    u = @key2userdir[user_key]
    u ? u.exists?(box_key) : false
  end
end
