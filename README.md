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

Write source notes in `notes/` with Obsidian-style wikilinks such as
`[[Use-After-Free]]`, `[[Use-After-Free|UAF]]`, and `#tags`.

Publish them to the Jekyll wiki with:

```sh
npm run notes:publish
```

Check for broken or ambiguous wikilinks with:

```sh
npm run notes:check
```

The generated pages live in `wiki/notes/`; edit the source files in `notes/`
instead of editing generated pages directly.
