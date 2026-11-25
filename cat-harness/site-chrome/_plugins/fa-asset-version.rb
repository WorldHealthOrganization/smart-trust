# frozen_string_literal: true

require "digest"

# `?v=` for first-party assets: a hash of what the asset IS, not of when the
# site was built.
#
#   <script src="{{ '/assets/js/docs-ui.js' | relative_url }}?v={{ '/assets/js/docs-ui.js' | fa_asset_version }}">
#
# WHY NOT `site.time`. It was `?v={{ site.time | date: '%s' }}` (2026-09-21):
# right about the reviewer who reopens a preview and gets yesterday's cached
# stylesheet, wrong about the bytes. The build time is new on every build, so
# EVERY page changed on every rebuild, and every re-push of a preview added a
# whole new copy of its HTML to the publish branch (bean `g196`, measured
# 2026-10-23). A content hash busts the cache exactly when the asset changed
# and leaves the page byte-identical when it did not.
#
# WHY THE RENDERED OUTPUT, not the source file. Some of these assets are
# rendered by Jekyll (front matter, Liquid over `site.data`), so their source
# can stay put while what is served changes. The filter therefore only leaves
# a marker; once every page is rendered, the `:post_render` hook below hashes
# the asset as it will be written (a page's or document's `output`, or a
# static file's bytes) and puts the hash in place of the marker.
#
# AN ASSET THAT CANNOT BE FOUND gets the constant `unresolved` and a warning,
# never the build time: a missing asset is a broken link, which the publish
# link check already refuses, and falling back to the time would quietly bring
# the churn back.
module FaAssetVersion
  MARKER = /__FA_ASSET_VERSION__\[([^\]\s"'<>]+)\]__/.freeze
  UNRESOLVED = "unresolved"

  module Filter
    def fa_asset_version(path)
      p = path.to_s.strip
      p = "/#{p}" unless p.start_with?("/")
      "__FA_ASSET_VERSION__[#{p}]__"
    end
  end

  # Every asset the site will write, by its URL path, as the bytes it will
  # have. Built lazily: only paths a marker asks for are hashed.
  class Lookup
    def initialize(site)
      @site = site
      @hashes = {}
    end

    def [](path)
      return @hashes[path] if @hashes.key?(path)

      bytes = rendered(path) || static(path)
      @hashes[path] =
        if bytes.nil?
          Jekyll.logger.warn("fa_asset_version:", "no asset at #{path}; ?v=#{UNRESOLVED}")
          UNRESOLVED
        else
          Digest::SHA256.hexdigest(bytes)[0, 12]
        end
    end

    private

    def rendered(path)
      item = (@site.pages + @site.documents).find { |p| p.url == path }
      item&.output
    end

    def static(path)
      file = @site.static_files.find { |f| f.url == path }
      file && File.binread(file.path)
    end
  end

  def self.resolve(site)
    lookup = Lookup.new(site)
    (site.pages + site.documents).each do |item|
      out = item.output
      next unless out.is_a?(String) && out.include?("__FA_ASSET_VERSION__[")

      item.output = out.gsub(MARKER) { lookup[Regexp.last_match(1)] }
    end
  end
end

Liquid::Template.register_filter(FaAssetVersion::Filter)

Jekyll::Hooks.register :site, :post_render do |site, _payload|
  FaAssetVersion.resolve(site)
end
