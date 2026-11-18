# frozen_string_literal: true

# Liquid's `strict_variables`, as a MESSAGE rather than a failed build.
#
# Owner, 2026-10-09 (bean `8pyz`): *"jekyll strict (if not error out, just
# message)"*. Jekyll's default renders an undefined variable as the empty
# string with no word anywhere: smart-immunizations' `testing.html` shipped
# four `raw.githubusercontent.com///main/...` links that way, its
# `site.data.features.github.*` undefined at build time. Jekyll's own
# `liquid: strict_variables: true` would have caught it -- by FAILING the
# build, and by changing what renders: the exception aborts the whole tag, so
# an `{% if x %}...{% else %}fallback{% endif %}` over an undefined `x` loses
# its fallback too.
#
# So this never changes what a page renders. Every lookup runs exactly as
# Liquid runs it; only when one comes back nil does it ask, without side
# effects, whether a segment of the path was ABSENT (as opposed to present
# and nil), and record it. Not recorded, because there an undefined value is
# the template's intent rather than a gap:
#
# - inside a condition (`if`, `unless`, `elsif`, `case`/`when`) -- testing
#   whether a thing exists is how a template asks;
# - under a `default` filter -- the template supplied the fallback;
# - an include's own parameter (`include.x`) -- every one is optional by
#   Liquid's convention, and just-the-docs alone left 177 of them on one site;
# - a path `liquid_undefined_ignore` in `_config.yml` lists (a prefix, matched
#   at a segment boundary) -- for a THEME's optional settings, which the
#   site's own authors cannot define and should not be told about.
#
# Measured on smart-immunizations, 2026-10-09: 399 references before these
# two rules, 395 of them just-the-docs' own parameters and settings; the four
# left were real -- IG Publisher data (`site.data.resources`,
# `site.data.fhir.igId`) the page reads and no build supplies.
#
# At the end of the build every recorded path is printed as a warning, with
# how many times and on which pages, the `site.data.*` ones first. With
# `FOLIO_LIQUID_UNDEFINED_REPORT=<file>` the same record is written as JSON,
# for a QA sidecar. `liquid_undefined: off` in `_config.yml` turns it off.
#
# Only where custom plugins run -- a `bundle exec jekyll build`, as an IG
# repository's own site and `preview:site` do. The github-pages build runs in
# safe mode and loads no `_plugins/`, so there this file is inert.

require "json"

module FolioLiquidUndefined
  COMMANDS = %w[size first last].freeze

  class << self
    def records
      @records ||= Hash.new { |h, k| h[k] = { count: 0, pages: [] } }
    end

    def reset!
      @records = nil
    end

    def enabled?
      @enabled != false
    end

    attr_writer :enabled

    def ignore=(prefixes)
      @ignore = Array(prefixes).map(&:to_s).reject(&:empty?)
    end

    # An include's parameters, and whatever the site's configuration names.
    def ignored?(path)
      (["include"] + (@ignore || [])).any? { |p| path == p || path.start_with?("#{p}.") }
    end

    def quiet?
      (Thread.current[:folio_liquid_quiet] || 0).positive?
    end

    def quietly
      Thread.current[:folio_liquid_quiet] = (Thread.current[:folio_liquid_quiet] || 0) + 1
      yield
    ensure
      Thread.current[:folio_liquid_quiet] -= 1
    end

    def record(path, context)
      page = context.registers[:page]
      where = (page.respond_to?(:[]) && page["path"]) || context.template_name || "(unknown page)"
      r = records[path]
      r[:count] += 1
      r[:pages] << where.to_s unless r[:pages].include?(where.to_s) || r[:pages].size >= 5
    end

    # The first ABSENT segment of `lookup`'s path, as the path up to and
    # including it -- or nil when every segment is present (the value is nil).
    def absent_path(lookup, context)
      name = context.evaluate(lookup.name)
      return nil unless name.is_a?(String)
      present = context.scopes.any? { |s| s.key?(name) } ||
                context.environments.any? { |e| e.respond_to?(:key?) && e.key?(name) }
      return name unless present

      object = context.find_variable(name)
      path = [name]
      lookup.lookups.each do |raw|
        # A variable that is there and nil: its own cause was reported where it
        # went undefined (`assign x = site.data.gone` reports site.data.gone),
        # so `x.y` would only report it twice.
        return nil if object.nil?
        key = context.evaluate(raw)
        path << key.to_s
        if object.respond_to?(:[]) &&
           ((object.respond_to?(:key?) && object.key?(key)) || (object.respond_to?(:fetch) && key.is_a?(Integer)))
          object = object[key]
          object = object.to_liquid if object.respond_to?(:to_liquid)
        elsif COMMANDS.include?(key) && object.respond_to?(key)
          object = object.send(key)
        else
          return path.join(".")
        end
        return nil if object.nil?
      end
      nil
    end

    def report(io = $stderr)
      return if records.empty?
      ordered = records.sort_by { |path, r| [path.start_with?("site.data.") ? 0 : 1, -r[:count], path] }
      total = records.values.sum { |r| r[:count] }
      Jekyll.logger.warn "Liquid undefined:", "#{total} reference(s) to #{records.size} undefined variable(s) rendered EMPTY (not a build failure; bean 8pyz)"
      ordered.first(50).each do |path, r|
        Jekyll.logger.warn "", "#{path} -- #{r[:count]}x, e.g. #{r[:pages].join(', ')}"
      end
      Jekyll.logger.warn "", "... and #{records.size - 50} more" if records.size > 50
    end

    def write(file)
      data = records.map { |path, r| { path: path, count: r[:count], pages: r[:pages] } }
      File.write(file, JSON.pretty_generate({ "$schema" => "folio-liquid-undefined/v1", undefined: data }) + "\n")
    end
  end

  module Lookup
    def evaluate(context)
      result = super
      if result.nil? && FolioLiquidUndefined.enabled? && !FolioLiquidUndefined.quiet?
        path = FolioLiquidUndefined.quietly { FolioLiquidUndefined.absent_path(self, context) }
        FolioLiquidUndefined.record(path, context) if path && !FolioLiquidUndefined.ignored?(path)
      end
      result
    end
  end

  module Quiet
    def evaluate(context = Liquid::Context.new)
      FolioLiquidUndefined.quietly { super }
    end
  end

  module DefaultFilter
    def render(context)
      return super unless filters.any? { |f| f[0] == "default" }
      FolioLiquidUndefined.quietly { super }
    end
  end
end

Liquid::VariableLookup.prepend(FolioLiquidUndefined::Lookup)
Liquid::Condition.prepend(FolioLiquidUndefined::Quiet)
Liquid::Variable.prepend(FolioLiquidUndefined::DefaultFilter)

Jekyll::Hooks.register :site, :after_init do |site|
  FolioLiquidUndefined.enabled = site.config["liquid_undefined"].to_s != "off"
  FolioLiquidUndefined.ignore = site.config["liquid_undefined_ignore"]
end

Jekyll::Hooks.register :site, :pre_render do |_site, _payload|
  FolioLiquidUndefined.reset!
end

Jekyll::Hooks.register :site, :post_render do |_site|
  FolioLiquidUndefined.report
  out = ENV["FOLIO_LIQUID_UNDEFINED_REPORT"]
  FolioLiquidUndefined.write(out) if out && !out.empty?
end
