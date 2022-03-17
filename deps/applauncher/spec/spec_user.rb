# frozen_string_literal: true

def require_root(path)
  require_relative "../src/#{path}"
end
