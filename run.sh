#!/bin/bash

if [ -x /opt/homebrew/opt/ruby/bin/bundle ]; then
  export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
fi

bundle exec jekyll serve
