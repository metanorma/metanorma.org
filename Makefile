SHELL := /bin/bash

all: _site

clean:
	bundle exec jekyll clean
	rm -rf _site _software/*/.git _software/*/docs _software/*/_*_repo parent-hub

bundle:
	bundle

_site:
	bundle exec jekyll build --trace

serve:
	bundle exec jekyll serve --trace

.PHONY: bundle all open serve clean
