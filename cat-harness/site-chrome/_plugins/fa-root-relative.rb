# frozen_string_literal: true

# Same-site links in an HTML page are written RELATIVE TO THE PAGE, with no
# `baseurl` in them.
#
# WHY. Jekyll's `relative_url` and `{{ site.baseurl }}` prepend the deploy's
# base, `/folio-assistant` on the live site and
# `/folio-assistant/branches/<branch>` on a preview. So a page carried its
# preview's name in every link (~200 on a content page), no two previews
# shared a single HTML file, and each preview stored a whole copy of the site
# on the publish branch (bean `g196`; owner, 2026-10-23: change it at the
# source, for every site). Written relative to the page, a page that did not
# change is byte-identical in every preview and on the live site.
#
# HOW. From the moment the site has been read until every page is rendered,
# `baseurl` is a token: generators too (jekyll-relative-links turns a `.md`
# link into `relative_url` of its page at generate time, so a swap at
# `pre_render` missed every one of them; measured on a deployed preview,
# 2026-10-23). Every way a template reaches
# the base (`relative_url`, `absolute_url`, `site.baseurl`, a theme's or a
# plugin's own use of the config) yields the token, including inside an
# `include_cached` fragment that is rendered once and reused by every page:
# the token does not depend on the page, so the cache stays correct. Once
# everything is rendered, each output resolves its own tokens:
#
# - after an origin (`https://host/<token>`, from `absolute_url`, the SEO
#   tag, `site.url + site.baseurl`): the real base. An absolute URL is an
#   identity, and an identity is never relativized.
# - in an HTML page: the path from the page's directory up to the site root
#   (`.`, `..`, `../..`).
# - anywhere else (JSON, JS, XML, the search index), and in `404.html`, which
#   GitHub Pages serves at whatever depth was missing: the real base, as before.
#
# Static files are copied, never rendered, so they never hold the token.
module FaRootRelative
  TOKEN = "__FA_ROOT__"
  # The token with an optional origin before it and an optional slash: the
  # origin decides whether it is an identity, the slash is `relative_url`'s.
  PATTERN = %r{((?:https?:)?//[^/"'\s<>()]+)?/?#{TOKEN}}.freeze

  # The real base, held while the token stands in for it.
  @real = {}

  class << self
    def swap_in(site)
      @real[site.object_id] = site.config["baseurl"]
      site.config["baseurl"] = TOKEN
    end

    def real_base(site)
      base = @real.fetch(site.object_id, site.config["baseurl"]).to_s.chomp("/")
      base.empty? || base.start_with?("/") ? base : "/#{base}"
    end

    def resolve(site)
      base = real_base(site)
      (site.pages + site.documents).each do |item|
        out = item.output
        next unless out.is_a?(String) && out.include?(TOKEN)

        root = html?(item) ? up_to_root(item.url) : base
        item.output = out.gsub(PATTERN) do
          origin = Regexp.last_match(1)
          origin ? "#{origin}#{base}" : root
        end
      end
    ensure
      site.config["baseurl"] = @real.delete(site.object_id) if @real.key?(site.object_id)
    end

    # `/` and `/x.html` sit at the root: `.`. `/a/` and `/a/x.html`: `..`.
    def up_to_root(url)
      dir = url.end_with?("/") ? url : url.sub(%r{[^/]*\z}, "")
      depth = dir.split("/").count { |s| !s.empty? }
      depth.zero? ? "." : Array.new(depth, "..").join("/")
    end

    def html?(item)
      return false if item.url == "/404.html"

      %w(.html .htm).include?(item.output_ext.to_s)
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  FaRootRelative.swap_in(site)
end

Jekyll::Hooks.register :site, :post_render do |site, _payload|
  FaRootRelative.resolve(site)
end
