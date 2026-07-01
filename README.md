# BLAZER502
Personal Pages

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

## Study Notes

Source notes live in `notes/` and are written in an Obsidian-like style with
wikilinks such as `[[Use-After-Free]]`, `[[Use-After-Free|UAF]]`, and `#tags`.
They publish to interlinked wiki pages under `/notes/` on the site.

### Organize by topic

**A note's top-level folder is its topic.** The published index at `/notes/`
groups notes into a "Notes by Topic" section, one heading per folder, with a
count. Add a new topic simply by adding a new folder:

```
notes/
  concepts/      -> "Concepts" section
  papers/        -> "Papers" section
  networking/    -> "Networking" section  (just create the folder)
```

Tags (`#security`, `tags: [paper]`) are the cross-cutting axis: one note can
carry many tags, and every tag gets its own page under `/notes/tags/`.

### Add a note

1. Copy a starter from `notes/templates/` (`concept.md` or `paper.md`) into the
   right topic folder, e.g. `notes/networking/tcp-congestion-control.md`.
2. Fill in the frontmatter (`title`, `aliases`, `tags`, `status`) and body.
3. Link related notes with `[[Wikilinks]]`; backlinks are generated
   automatically.

### Publish & check

```sh
npm run notes:publish   # regenerate wiki/notes/ from notes/
npm run notes:check     # report broken or ambiguous wikilinks
```

The generated pages live in `wiki/notes/`; always edit the source files in
`notes/` instead of the generated pages.
