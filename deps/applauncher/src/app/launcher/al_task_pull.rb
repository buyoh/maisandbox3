# frozen_string_literal: false

require 'fileutils'
require_relative 'al_task'

class ALTaskPull
  include ALTask

  def initialize(box, files)
    @box = box
    @files = files
  end

  class FileData
    def initialize(path, data)
      self.path = path
      self.data = data
    end

    attr_accessor :path, :data

    def self.check_valid_filequery(path)
      !path.nil? && !path.start_with?('/') && !path.include?('..')
    end

    def self.from_json(param)
      path = param['path']
      # data = param['data']
      return nil unless (path.is_a? String) && !path.empty?
      # return nil unless data.is_a? String
      return nil unless FileData.check_valid_filequery(path)

      FileData.new(path, '')
    end
  end

  def self.from_json(param)
    box = param['box']
    files = param['files']
    return nil unless box.is_a? String
    return nil unless files.is_a? Array

    # @type var files: untyped
    files = files.map { |f| FileData.from_json(f) }.compact
    return nil if files.empty?

    new(box, files)
  end

  def action(reporter, local_storage, directory_manager)
    ls_chdir = directory_manager.get_boxdir(local_storage[:user_id_str], @box)
    unless ls_chdir
      report_failed reporter, 'uninitialized box'
      return nil
    end

    total_limit_size = 400_000
    limit_size = 100_000
    total_size = 0
    result_files = []
    @files.each do |file|
      path = ls_chdir + file.path
      data = nil
      if File.exist?(path)
        if total_limit_size > total_size
          data = IO.read(path, limit_size) || ''
          total_size += data.size
        else
          data = ''
        end
      end
      data&.force_encoding('utf-8')
      result_files << {
        path: file.path,
        data: data
      }
    end
    reporter.report({ success: true, files: result_files })
    nil
  end
end
