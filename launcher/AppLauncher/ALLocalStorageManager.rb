# frozen_string_literal: true

require_relative 'ALLocalStorage'

class ALLocalStorageManager
  def initialize
    @collection = Hash.new { ALLocalStorage.new }
  end

  def [](key)
    @collection[key] = @collection[key]
  end

  def size
    @collection.size
  end
end
