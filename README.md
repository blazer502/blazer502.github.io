# BLAZER502
Personal Pages

## Site structure

The CV is the landing page, with the blog one click away in the nav:

| Area | URL | Source |
| --- | --- | --- |
| CV (home) | `/` | `index.html` |
| Blog | `/blog/` | `blog.html` + posts in `_posts/` |

Shared chrome (nav, footer, SEO) lives in `_layouts/base.html`; posts use
`_layouts/post.html`. Styling is in `styles.css`.

## Blog

Add a post by creating `_posts/YYYY-MM-DD-title.md`:

```markdown
---
title: "Your title"
date: 2026-07-01
category: Security        # shown next to the date; groups the post
tags: [security, memory-safety]
description: "One or two sentences used for the excerpt and social preview."
---

Write in Markdown. The first paragraph is used as the excerpt on the home page.
```

Posts appear newest-first at `/blog/` and get a clean URL like
`/blog/2026/07/01/title/`. No `layout:` line is needed — it is applied
automatically.

## AI-friendly knowledge layer (OKF)

The site publishes a machine-readable knowledge layer for AI agents, built on
Google's [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
(OKF). It is **auto-generated at build time** from the blog posts, so it never
drifts — you don't have to maintain it by hand. Adding a post automatically
adds it to the bundle, the log, and `llms.txt`.

| Output | Source | Purpose |
| --- | --- | --- |
| `/okf/index.md` | `okf/index.html` | OKF bundle root; progressive-disclosure map |
| `/okf/cv.md` | `okf/cv.html` | OKF concept for the CV / profile |
| `/okf/log.md` | `okf/log.html` | Update log built from post dates |
| `/okf/profile.md` | `okf/profile.html` | How this bundle adapts OKF (the "OKF-Blog profile") |
| `/llms.txt` | `llms.html` | AI-discovery index pointing to the bundle |
| `/robots.txt` | `robots.html` | Welcomes crawlers; references the bundle + sitemap |

Each `okf/*.html` / `*.html` source uses a minimal Jekyll front-matter block
(`layout: null` + a `.md`/`.txt` `permalink`) so Jekyll emits **raw markdown /
text** rather than an HTML page — no plugins, works on GitHub Pages. Every page
also advertises the bundle via `<link rel="alternate" type="text/markdown">`,
and each post carries `BlogPosting` JSON-LD.

## Local Jekyll Setup

This site expects Ruby 3 or newer. On this machine, use the Homebrew Ruby before
running Bundler:

```sh
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
bundle config set --local path vendor/bundle
bundle install
bundle exec jekyll build
```

For local serving:

```sh
./run.sh
```

## Notes (retired)

The old Obsidian-style Notes / wiki area (built on the `git-wiki-theme`) is no
longer published — it clashed with the site's design. The source vault
(`notes/`), the generated wiki (`wiki/`), and the tooling (`scripts/`) are still
in the repo but are listed under `exclude:` in `_config.yml`, so Jekyll does not
serve them. To bring it back, remove `wiki` and `notes` from that `exclude`
list; to delete it for good, remove those directories and the notes scripts.
