# frozen_string_literal: true

class BoxDir
  def initialize(dirname)
    @dirname = dirname
  end
  attr_reader :dirname
end
