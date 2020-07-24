# frozen_string_literal: true

require_relative 'AppLauncherLocalStorage'

class AppLauncherLocalStorageManager
  def initialize
    @collection = Hash.new { AppLauncherLocalStorage.new }
  end

  def [](key)
    @collection[key] = @collection[key]
  end

  def size
    @collection.size
  end
end
