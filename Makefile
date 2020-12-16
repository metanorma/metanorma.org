SHELL := /bin/bash

all: _site

clean:
	rm -rf _site

bundle:
	bundle

_site:
	bundle exec jekyll build --trace

serve:
	bundle exec jekyll serve --trace

.PHONY: bundle all open serve distclean clean
