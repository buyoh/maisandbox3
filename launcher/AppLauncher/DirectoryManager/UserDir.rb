# frozen_string_literal: true

require_relative 'BoxDir'

class UserDir
  def initialize(dirname)
    @dirname = dirname
    @key2box = {}
    @boxid_counter = 1
  end
  attr_reader :dirname

  def new_dir
    key = (@dirname + @boxid_counter.to_s).hash.to_s(36)
    @boxid_counter += 1
    box_dirname = '_j_' + key.hash.to_s(36) + '/'
    @key2box[key] = BoxDir.new(box_dirname)
    key
  end

  def get_boxdir(key)
    box = @key2box[key]
    return nil unless box

    box.dirname
  end

  def delete_box(key)
    @key2box.delete key
  end

  def exists?(key)
    !@key2box[key].nil?
  end
end
